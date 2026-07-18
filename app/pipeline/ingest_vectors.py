"""Ingest vector store: catalog_collection + policy_collection (ChromaDB).

- Catalog: mỗi sản phẩm 1 document mô tả tự nhiên (kèm câu paraphrase đời thường
  cho số liệu khô — Flow_RAG.md, làm 1 lần lúc ingestion).
- Policy: chunk 6 file chính sách .md theo cấu trúc mục/điều (flow_data_policy.md)
  + voucher chung tách từ pipeline promotion.

Chạy:  python -m app.pipeline.ingest_vectors [--limit N]
"""
import argparse
import json
import re
import sys
import uuid
from datetime import datetime

from app import config, db
from app.services import embeddings, rag

# ── Catalog document ───────────────────────────────────────────────

SPEC_LABELS = {}  # slug -> nhãn gốc, build từ dữ liệu khi chạy


def _fmt_price(v: int) -> str:
    if v >= 1_000_000:
        trieu = v / 1_000_000
        s = f"{trieu:.1f}".rstrip("0").rstrip(".")
        return f"{s} triệu"
    return f"{v:,}đ".replace(",", ".")


def _num(s: str):
    m = re.search(r"[\d.,]+", s or "")
    if not m:
        return None
    try:
        return float(m.group(0).replace(".", "").replace(",", "."))
    except ValueError:
        return None


def paraphrase(specs: dict, category: str) -> list[str]:
    """Câu diễn giải đời thường cạnh số liệu khô — tăng điểm neo ngữ nghĩa."""
    out = []
    for key, val in specs.items():
        if not val:
            continue
        if "dung_luong_pin" in key:
            mah = _num(val)
            if mah and mah >= 4000:
                out.append("pin trâu, dùng lâu cả ngày không lo hết pin")
        elif key.startswith("do_on"):
            db_ = _num(val)
            if db_ and db_ <= 45:
                out.append("vận hành êm ái, ít ồn, chạy êm hợp phòng ngủ")
        elif "nhan_nang_luong" in key and "5" in val:
            out.append("tiết kiệm điện tốt")
        elif "inverter" in val.lower():
            out.append("công nghệ Inverter tiết kiệm điện")
        elif "camera_sau" in key:
            mp = _num(val)
            if mp and mp >= 48:
                out.append("camera chụp đẹp, sắc nét, hợp chụp ảnh sống ảo")
        elif key in ("ram", "dung_luong_ram"):
            gb = _num(val)
            if gb and gb >= 8:
                out.append("cấu hình mạnh, chạy mượt, chiến game tốt")
        elif "thoi_gian_su_dung" in key or "thoi_luong_pin" in key:
            out.append("pin dùng được lâu")
    return list(dict.fromkeys(out))[:4]


def build_doc(p: dict) -> str:
    specs = p["specs"] or {}
    price = p["sale_price"] or p["original_price"]
    parts = [
        f"{p['product_name']}.",
        f"Thương hiệu {p['brand']}." if p["brand"] else "",
        f"Danh mục: {p['category_label']}.",
        f"Giá khoảng {_fmt_price(price)}.",
    ]
    if p["outstanding_features"]:
        parts.append(p["outstanding_features"])
    spec_lines = [f"{k.replace('_', ' ')}: {v}" for k, v in specs.items() if v]
    parts.append(". ".join(spec_lines[:25]))
    parts.extend(paraphrase(specs, p["category"]))
    return " ".join(x for x in parts if x)


def ingest_catalog(limit: int | None = None, resume: bool = False):
    products = json.load(open(config.PROCESSED_DIR / "products.json", encoding="utf-8"))
    if limit:
        products = products[:limit]
    # ChromaDB mới không cho cập nhật HNSW metadata của collection đã tồn tại.
    # Lấy collection sẵn có trước; chỉ gán metadata khi khởi tạo lần đầu.
    try:
        col = rag.client().get_collection("catalog_collection")
    except Exception:
        col = rag.client().create_collection(
            "catalog_collection", metadata={"hnsw:space": "cosine"})
    if resume:
        done = set(col.get(include=[])["ids"])
        products = [p for p in products if p["product_code"] not in done]
        print(f"Resume: {len(done)} đã có sẵn, còn {len(products)} cần ingest")
    print(f"Ingest catalog: {len(products)} sản phẩm...")
    BATCH = 128
    for i in range(0, len(products), BATCH):
        batch = products[i:i + BATCH]
        docs = [build_doc(p) for p in batch]
        metas = []
        for p in batch:
            m = {
                "product_code": p["product_code"],
                "category": p["category"],
                "category_label": p["category_label"],
                "price": p["sale_price"] or p["original_price"],
                "product_name": p["product_name"],
                "brand": p["brand"] or "",
            }
            if p.get("device_type"):
                m["device_type"] = p["device_type"]
            metas.append(m)
        col.upsert(ids=[p["product_code"] for p in batch], documents=docs,
                   metadatas=metas, embeddings=embeddings.embed(docs))
        print(f"  {min(i + BATCH, len(products))}/{len(products)}", flush=True)


# ── Policy ─────────────────────────────────────────────────────────

POLICY_FILES = {
    "chinh_sach_bao_hanh_doi_tra.md": ("bảo_hành_đổi_trả", "Chính sách bảo hành đổi trả"),
    "chinh_sach_giao_hang_lap_dat.md": ("giao_hàng_lắp_đặt", "Chính sách giao hàng lắp đặt"),
    "chinh_sach_xu_ly_du_lieu_ca_nhan.md": ("bảo_mật_dữ_liệu", "Chính sách xử lý dữ liệu cá nhân"),
    "dieu-khoang-su-dung.md": ("điều_khoản_sử_dụng", "Điều khoản sử dụng"),
    "chat_luong_phuc_vu.md": ("chăm_sóc_khách_hàng", "Cam kết chất lượng phục vụ"),
    "chinh_sach_khui_hop_apple.md": ("khác", "Chính sách khui hộp sản phẩm Apple"),
}

_HEADING_RE = re.compile(r"^(#{1,3}\s+.+|\d+[\)\.]\s+.+|[IVX]+[\)\.]\s+.+|ĐIỀU\s+\d+.*)$",
                         re.MULTILINE)


def chunk_document(text: str) -> list[dict]:
    """Chunk theo cấu trúc mục/điều; văn bản ngắn không cấu trúc → giữ 1 chunk."""
    matches = list(_HEADING_RE.finditer(text))
    if len(matches) < 2:
        body = text.strip()
        return [{"index": 0, "section_title": None, "text": body}] if body else []
    chunks = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if not body:
            continue
        title = m.group(0).lstrip("#").strip()
        chunks.append({"index": len(chunks), "section_title": title, "text": body})
    # Gộp phần mở đầu trước heading đầu tiên (nếu có nội dung)
    intro = text[:matches[0].start()].strip()
    if intro:
        chunks.insert(0, {"index": -1, "section_title": None, "text": intro})
        for i, c in enumerate(chunks):
            c["index"] = i
    return chunks


def ingest_policies():
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    with db.cursor(write=True) as cur:
        cur.execute("DELETE FROM policies")
        cur.execute("DELETE FROM policy_chunks")
    try:
        rag.client().delete_collection("policy_collection")
    except Exception:
        pass

    entries = []
    for fname, (ptype, title) in POLICY_FILES.items():
        path = config.POLICY_DOCS_DIR / fname
        if not path.exists():
            print(f"  BỎ QUA (không thấy file): {fname}")
            continue
        entries.append((fname, ptype, title, path.read_text(encoding="utf-8")))

    # Voucher chung toàn hệ thống (tách từ pipeline promotion) → policy_collection
    vouchers = json.load(open(config.PROCESSED_DIR / "policies.json", encoding="utf-8"))
    if vouchers.get("common_vouchers"):
        text = "Khuyến mãi chung toàn hệ thống (áp dụng cho mọi sản phẩm):\n- " + \
               "\n- ".join(vouchers["common_vouchers"])
        entries.append(("promotions_common.json", "khác", "Khuyến mãi chung toàn hệ thống", text))

    for fname, ptype, title, text in entries:
        policy_id = "pol_" + uuid.uuid4().hex[:8]
        chunks = chunk_document(text)
        rag.add_policy_chunks(policy_id, ptype, fname, chunks)
        with db.cursor(write=True) as cur:
            cur.execute(
                "INSERT INTO policies (id,title,policy_type,status,source_file,uploaded_by,"
                "uploaded_at,chunk_count,replaces_policy_id) VALUES (?,?,?,?,?,?,?,?,?)",
                (policy_id, title, ptype, "active", fname, "ingest", now, len(chunks), None))
            for c in chunks:
                cur.execute(
                    "INSERT INTO policy_chunks (id,policy_id,idx,section_title,text,deprecated) "
                    "VALUES (?,?,?,?,?,0)",
                    (f"{policy_id}_{c['index']}", policy_id, c["index"],
                     c.get("section_title"), c["text"]))
        print(f"  {title}: {len(chunks)} chunk")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="chỉ ingest N sản phẩm đầu (test nhanh)")
    ap.add_argument("--policies-only", action="store_true")
    ap.add_argument("--resume", action="store_true", help="bỏ qua sản phẩm đã có trong collection")
    ap.add_argument("--skip-policies", action="store_true")
    args = ap.parse_args()
    if not args.skip_policies:
        ingest_policies()
    if not args.policies_only:
        ingest_catalog(args.limit, resume=args.resume)
    print("Xong.")
