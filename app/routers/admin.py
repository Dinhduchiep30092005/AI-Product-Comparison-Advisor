"""Admin API (API_contract.md mục 3) — auth session token đơn giản, không public.

PATCH sản phẩm → (1) invalidate cache MCP, (2) check_alert(product_id) — Lớp 1.
Policy upload 2 bước: preview (parse+chunk, chưa lưu) → confirm (embed+lưu);
replaces_policy_id do hệ thống TỰ ĐIỀN khi trùng policy_type, admin chỉ xác nhận.
"""
import io
import json
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile
from pydantic import BaseModel

from app import config, db
from app.pipeline.ingest_vectors import chunk_document
from app.pipeline.textnorm import clean_text, slugify
from app.services import alerts, audit, rag
from app.tools import cache

router = APIRouter(prefix="/admin")

_tokens: set[str] = set()
_previews: dict[str, dict] = {}


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ── Auth ───────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginBody):
    if body.username != config.ADMIN_USERNAME or body.password != config.ADMIN_PASSWORD:
        raise HTTPException(401, detail="Sai tên đăng nhập hoặc mật khẩu")
    token = secrets.token_urlsafe(24)
    _tokens.add(token)
    return {"success": True, "token": token}


def require_auth(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if token not in _tokens:
        raise HTTPException(401, detail="Chưa đăng nhập")
    return token


@router.post("/logout")
def logout(token: str = Depends(require_auth)):
    _tokens.discard(token)
    return {"success": True}


# ── Dashboard ──────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(require_auth)])
def stats():
    with db.cursor() as cur:
        cur.execute("SELECT COUNT(*) c FROM products")
        total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) c FROM products WHERE stock_status='in_stock'")
        in_stock = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) c FROM policies WHERE status='active'")
        policies = cur.fetchone()["c"]
    return {"total_products": total, "in_stock": in_stock,
            "out_of_stock": total - in_stock, "policy_documents": policies}


# ── Quản lý sản phẩm ──────────────────────────────────────────────

@router.get("/products", dependencies=[Depends(require_auth)])
def list_products(search: str = "", category: str = "", page: int = 1):
    page_size = 20
    where, params = [], []
    if search:
        where.append("product_name LIKE ?")
        params.append(f"%{search}%")
    if category:
        where.append("category_label = ?")
        params.append(category)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    with db.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) c FROM products {where_sql}", params)
        total = cur.fetchone()["c"]
        cur.execute(
            f"""SELECT product_code, product_name, category_label, original_price,
                       sale_price, stock_quantity, stock_status, rating, image_url
                FROM products {where_sql} ORDER BY quantity_sold DESC NULLS LAST
                LIMIT ? OFFSET ?""", params + [page_size, (page - 1) * page_size])
        rows = cur.fetchall()
    return {"total": total, "page": page, "products": [
        {"product_id": r["product_code"], "product_name": r["product_name"],
         "category": r["category_label"], "original_price": r["original_price"],
         "sale_price": r["sale_price"], "stock_quantity": r["stock_quantity"],
         "stock_status": r["stock_status"], "rating": r["rating"],
         "image_url": r["image_url"]} for r in rows]}


@router.get("/products/categories", dependencies=[Depends(require_auth)])
def list_categories():
    with db.cursor() as cur:
        cur.execute("SELECT DISTINCT category_label FROM products ORDER BY category_label")
        return {"categories": [r[0] for r in cur.fetchall()]}


@router.get("/products/{product_id}", dependencies=[Depends(require_auth)])
def get_product(product_id: str):
    with db.cursor() as cur:
        cur.execute("SELECT * FROM products WHERE product_code=?", (product_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(404, detail="PRODUCT_NOT_FOUND")
    return db.row_to_dict(row)


class ProductCreate(BaseModel):
    product_name: str
    category_label: str
    brand: str | None = None
    original_price: int | None = None
    sale_price: int | None = None
    stock_quantity: int | None = None
    warranty: str | None = None
    color: str | None = None
    image_url: str | None = None
    product_url: str | None = None
    outstanding_features: str | None = None


@router.post("/products", dependencies=[Depends(require_auth)])
def create_product(body: ProductCreate):
    name = clean_text(body.product_name)
    label = clean_text(body.category_label)
    if not name:
        raise HTTPException(422, detail="Tên sản phẩm không được để trống")
    if not label:
        raise HTTPException(422, detail="Danh mục không được để trống")
    for price in (body.original_price, body.sale_price):
        if price is not None and price < 0:
            raise HTTPException(422, detail="Giá không được nhỏ hơn 0")
    if body.original_price is not None and body.sale_price is not None \
            and body.sale_price > body.original_price:
        raise HTTPException(422, detail="Giá khuyến mãi không được lớn hơn giá gốc")
    if body.stock_quantity is not None and body.stock_quantity < 0:
        raise HTTPException(422, detail="Tồn kho không được nhỏ hơn 0")

    # Tái sử dụng slug danh mục đã có (nếu trùng tên hiển thị), tránh sinh 2 slug cho 1 danh mục
    with db.cursor() as cur:
        cur.execute("SELECT category FROM products WHERE category_label=? LIMIT 1", (label,))
        row = cur.fetchone()
    category = row["category"] if row else slugify(label)

    product_code = "SP" + uuid.uuid4().hex[:10].upper()
    stock_status = "in_stock" if (body.stock_quantity or 0) > 0 else "out_of_stock"
    now = _now()
    with db.cursor(write=True) as cur:
        cur.execute(
            """INSERT INTO products (product_code, category, category_label, product_name, brand,
                   original_price, sale_price, stock_quantity, stock_status, warranty, color,
                   image_url, product_url, outstanding_features, quantity_sold, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)""",
            (product_code, category, label, name, clean_text(body.brand),
             body.original_price, body.sale_price, body.stock_quantity, stock_status,
             clean_text(body.warranty), clean_text(body.color), clean_text(body.image_url),
             clean_text(body.product_url), clean_text(body.outstanding_features), now))

    audit.log("admin_create_product", product_id=product_code, product_name=name)
    return {"success": True, "product_id": product_code, "created_at": now}


class ReviewPatch(BaseModel):
    rating: float | None = None
    review_count: int | None = None
    summary: str | None = None


class ProductPatch(BaseModel):
    original_price: int | None = None
    sale_price: int | None = None
    stock_quantity: int | None = None
    stock_status: str | None = None
    review: ReviewPatch | None = None


@router.patch("/products/{product_id}", dependencies=[Depends(require_auth)])
async def patch_product(product_id: str, body: ProductPatch):
    with db.cursor() as cur:
        cur.execute("SELECT * FROM products WHERE product_code=?", (product_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(404, detail="PRODUCT_NOT_FOUND")

    original = body.original_price if body.original_price is not None else row["original_price"]
    if body.sale_price is not None and original and body.sale_price > original:
        raise HTTPException(422, detail="Giá khuyến mãi không được lớn hơn giá gốc")
    for price in (body.original_price, body.sale_price):
        if price is not None and price < 0:
            raise HTTPException(422, detail="Giá không được nhỏ hơn 0")

    sets, params = [], []
    for field in ("original_price", "sale_price", "stock_quantity", "stock_status"):
        v = getattr(body, field)
        if v is not None:
            sets.append(f"{field}=?")
            params.append(v)
    # Quy tắc: tồn kho 0 → hết hàng, >0 → còn hàng (admin_interface.md 4.2)
    if body.stock_quantity is not None and body.stock_status is None:
        sets.append("stock_status=?")
        params.append("in_stock" if body.stock_quantity > 0 else "out_of_stock")
    if body.review is not None:
        if body.review.rating is not None:
            if not (0 <= body.review.rating <= 5):
                raise HTTPException(422, detail="Rating phải từ 0 đến 5")
            sets.append("rating=?")
            params.append(body.review.rating)
        if body.review.review_count is not None:
            if body.review.review_count < 0:
                raise HTTPException(422, detail="Số lượt đánh giá không được âm")
            sets.append("review_count=?")
            params.append(body.review.review_count)
        if body.review.summary is not None:
            sets.append("review_summary=?")
            params.append(clean_text(body.review.summary))
    if not sets:
        raise HTTPException(422, detail="Không có field nào để cập nhật")

    now = _now()
    sets.append("updated_at=?")
    params.append(now)
    with db.cursor(write=True) as cur:
        cur.execute(f"UPDATE products SET {', '.join(sets)} WHERE product_code=?",
                    params + [product_id])

    # ⚠ 2 việc BẮT BUỘC ngay sau PATCH thành công (API_contract.md 3.1)
    cache.invalidate(product_id)
    await alerts.check_alert(product_id)
    audit.log("admin_patch_product", product_id=product_id,
              fields=[s.split("=")[0] for s in sets])
    return {"success": True, "product_id": product_id,
            "updated_at": now, "cache_invalidated": True}


# ── Quản lý chính sách ────────────────────────────────────────────

@router.get("/policies", dependencies=[Depends(require_auth)])
def list_policies():
    with db.cursor() as cur:
        cur.execute("SELECT * FROM policies ORDER BY uploaded_at DESC")
        rows = cur.fetchall()
    return {"policies": [dict(r) for r in rows]}


@router.delete("/policies/{policy_id}", dependencies=[Depends(require_auth)])
def delete_policy(policy_id: str):
    with db.cursor() as cur:
        cur.execute("SELECT status FROM policies WHERE id=?", (policy_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(404, detail="POLICY_NOT_FOUND")
    if row["status"] != "active":
        raise HTTPException(422, detail="Chỉ có thể xoá chính sách đang dùng")

    # Không xoá hẳn chunk khỏi Chroma — chỉ đánh dấu deprecated (giữ audit trail,
    # cùng cơ chế với confirm_policy khi 1 tài liệu mới thay thế tài liệu cũ)
    rag.deprecate_policy(policy_id)
    with db.cursor(write=True) as cur:
        cur.execute("UPDATE policies SET status='deleted' WHERE id=?", (policy_id,))
        cur.execute("UPDATE policy_chunks SET deprecated=1 WHERE policy_id=?", (policy_id,))
    audit.log("admin_delete_policy", policy_id=policy_id)
    return {"success": True, "policy_id": policy_id}


def _parse_upload(file: UploadFile) -> str:
    data = file.file.read()
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    if name.endswith(".docx"):
        import docx
        d = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in d.paragraphs)
    return data.decode("utf-8", errors="replace")  # TXT/Markdown


@router.post("/policies/upload", dependencies=[Depends(require_auth)])
async def upload_policy(file: UploadFile | None = None, raw_text: str | None = None):
    if file is None and not raw_text:
        raise HTTPException(422, detail="Cần file hoặc raw_text")
    text = _parse_upload(file) if file is not None else raw_text
    text = "\n".join(clean_text(line) or "" for line in text.splitlines())
    chunks = chunk_document(text)
    if not chunks:
        raise HTTPException(422, detail="Không trích được nội dung từ tài liệu")
    preview_id = "prev_" + uuid.uuid4().hex[:4]
    _previews[preview_id] = {"chunks": chunks,
                             "source": file.filename if file else "nhập tay"}
    return {"preview_id": preview_id,
            "chunks": [{"index": c["index"], "text": c["text"]} for c in chunks]}


class ConfirmBody(BaseModel):
    preview_id: str
    policy_type: str
    title: str
    replaces_policy_id: str | None = None


@router.get("/policies/check-replace", dependencies=[Depends(require_auth)])
def check_replace(policy_type: str):
    """Hệ thống TỰ PHÁT HIỆN trùng policy_type đang active → frontend hiện cảnh báo."""
    with db.cursor() as cur:
        cur.execute("SELECT id, title FROM policies WHERE policy_type=? AND status='active'",
                    (policy_type,))
        row = cur.fetchone()
    if row is None:
        return {"will_replace": False, "replaces_policy_id": None}
    return {"will_replace": True, "replaces_policy_id": row["id"],
            "replaces_title": row["title"]}


@router.post("/policies/confirm", dependencies=[Depends(require_auth)])
def confirm_policy(body: ConfirmBody):
    if body.policy_type not in config.POLICY_TYPES:
        raise HTTPException(422, detail=f"policy_type phải thuộc: {config.POLICY_TYPES}")
    preview = _previews.pop(body.preview_id, None)
    if preview is None:
        raise HTTPException(404, detail="preview_id không tồn tại hoặc đã hết hạn")

    # Chunk cũ đánh dấu deprecated=true, không xoá hẳn
    if body.replaces_policy_id:
        rag.deprecate_policy(body.replaces_policy_id)
        with db.cursor(write=True) as cur:
            cur.execute("UPDATE policies SET status='deprecated' WHERE id=?",
                        (body.replaces_policy_id,))
            cur.execute("UPDATE policy_chunks SET deprecated=1 WHERE policy_id=?",
                        (body.replaces_policy_id,))

    policy_id = "pol_" + uuid.uuid4().hex[:8]
    chunks = preview["chunks"]
    rag.add_policy_chunks(policy_id, body.policy_type, preview["source"], chunks)
    with db.cursor(write=True) as cur:
        cur.execute(
            "INSERT INTO policies (id,title,policy_type,status,source_file,uploaded_by,"
            "uploaded_at,chunk_count,replaces_policy_id) VALUES (?,?,?,?,?,?,?,?,?)",
            (policy_id, body.title, body.policy_type, "active", preview["source"],
             "admin", _now(), len(chunks), body.replaces_policy_id))
        for c in chunks:
            cur.execute(
                "INSERT INTO policy_chunks (id,policy_id,idx,section_title,text,deprecated) "
                "VALUES (?,?,?,?,?,0)",
                (f"{policy_id}_{c['index']}", policy_id, c["index"],
                 c.get("section_title"), c["text"]))
    audit.log("admin_policy_confirm", policy_id=policy_id, policy_type=body.policy_type)
    return {"success": True, "policy_id": policy_id, "chunks_embedded": len(chunks),
            "message": "Đã cập nhật, AI sẽ dùng dữ liệu mới ngay lập tức"}
