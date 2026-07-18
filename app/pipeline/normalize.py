"""Pipeline chuẩn hoá dữ liệu sản phẩm theo data_normalization.md.

Nguồn canonical: products_detail.json → data/processed/{products,promotions,policies}.json
+ data/reports/{data_validation_report,data_conflicts}.json → nạp vào SQLite.

Chạy:  python -m app.pipeline.normalize
"""
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime

from app import config, db
from app.pipeline.textnorm import clean_text, slugify

# Mapping trường nguồn -> trường chuẩn (mục 3)
FIELD_MAP = {
    "tên sản phẩm": "product_name",
    "category_name": "category_label",
    "productcode": "product_code",
    "Giá gốc": "original_price",
    "Giá khuyến mãi": "sale_price",
    "rating_vote": "rating",
    "màu sắc": "color",
    "Phụ kiện đi kèm": "accessories",
    "chính sách bảo hành": "warranty",
    "outstanding": "outstanding_features",
    "spec_product": "specs",
    "url_image": "image_url",
    "url": "product_url",
    "onlineSaleOnly": "online_sale_only",
}

VOUCHER_COMMON_THRESHOLD = 0.5  # fragment xuất hiện >50% sp có promotion → voucher chung


def parse_price(v):
    if v is None or v == "":
        return None
    try:
        p = int(float(v))
        return p if p > 0 else None
    except (TypeError, ValueError):
        return None


def parse_rating(v):
    s = clean_text(v)
    if s is None:
        return None
    try:
        r = float(s.replace(",", "."))
        return r if 0 <= r <= 5 else None
    except ValueError:
        return None


def parse_quantity_sold(v):
    """VD "14,5k" -> 14500; "800" -> 800."""
    s = clean_text(v)
    if s is None:
        return None
    s = s.lower().replace(".", ",")
    m = re.match(r"^([\d,]+)\s*(k)?$", s)
    if not m:
        return None
    num = m.group(1).replace(",", ".")
    try:
        val = float(num)
    except ValueError:
        return None
    if m.group(2) == "k":
        val *= 1000
    return int(val)


def derive_device_type(category_label: str, product_name: str, specs: dict):
    """Tách device_type lúc ingestion (Flow_slot_filling.md category pc/máy in + loa/tai nghe)."""
    cat = (category_label or "").lower()
    name = (product_name or "").lower()
    keys = set(specs.keys()) if specs else set()

    def has_key(*subs):
        return any(any(sub in k for sub in subs) for k in keys)

    if cat == "pc, máy in":
        if "mực" in name or "hộp mực" in name:
            return "phu_kien_muc_in"
        if "quét mã vạch" in name:
            return "may_quet"
        if has_key("chip_xu_ly", "cpu"):
            return "pc_de_ban"
        if has_key("toc_do_in"):
            return "may_in"
        if has_key("kich_thuoc_man_hinh") and has_key("tan_so_quet"):
            return "man_hinh"
        return "khac"
    if cat == "loa, tai nghe":
        if "tai nghe" in name:
            return "tai_nghe"
        if "loa" in name:
            return "loa"
        return "khac"
    return None


def normalize_specs(raw_specs):
    """Key spec -> snake_case; giá trị rỗng -> null. Trả (specs, unmapped_count)."""
    specs = {}
    if not isinstance(raw_specs, dict):
        return specs
    for k, v in raw_specs.items():
        key = slugify(k)
        if not key:
            continue
        specs[key] = clean_text(v)
    return specs


def normalize_product(raw: dict):
    p = {}
    for src, dst in FIELD_MAP.items():
        p[dst] = raw.get(src)

    p["product_id"] = clean_text(raw.get("product_id"))
    p["product_code"] = clean_text(p.get("product_code"))
    p["category_id"] = clean_text(raw.get("category_id"))
    p["category_label"] = clean_text(p.get("category_label"))
    p["category"] = slugify(p["category_label"]) if p["category_label"] else None
    p["product_name"] = clean_text(p.get("product_name"))
    p["brand"] = clean_text(raw.get("brand"))
    p["original_price"] = parse_price(p.get("original_price"))
    p["sale_price"] = parse_price(p.get("sale_price"))
    p["rating"] = parse_rating(p.get("rating"))
    p["quantity_sold"] = parse_quantity_sold(raw.get("quantity_sold"))
    p["color"] = clean_text(p.get("color"))
    p["accessories"] = clean_text(p.get("accessories"))
    p["warranty"] = clean_text(p.get("warranty"))
    p["promotion"] = clean_text(raw.get("promotion"))
    p["outstanding_features"] = clean_text(p.get("outstanding_features"))
    p["specs"] = normalize_specs(raw.get("spec_product"))
    p["image_url"] = clean_text(p.get("image_url"))
    p["product_url"] = clean_text(p.get("product_url"))
    p["online_sale_only"] = bool(raw.get("onlineSaleOnly", False))
    p["device_type"] = derive_device_type(p["category_label"], p["product_name"], p["specs"])

    ts = clean_text(raw.get("time_crawler"))
    if ts:
        ts = ts.replace(" ", "T")
    p["source"] = {
        "source_type": "catalog",
        "source_file": "products_detail.json",
        "updated_at": ts,
    }
    return p


def split_common_vouchers(products):
    """Mục 6b: tách voucher chung (>50% sp có promotion) khỏi promotion riêng."""
    frags_per_product = {}
    counter = Counter()
    with_promo = 0
    for p in products:
        if not p["promotion"]:
            continue
        with_promo += 1
        frags = [clean_text(f) for f in p["promotion"].split(";")]
        frags = [f for f in frags if f]
        frags_per_product[p["product_code"]] = frags
        counter.update(set(frags))

    common = {f for f, c in counter.items() if with_promo and c / with_promo > VOUCHER_COMMON_THRESHOLD}
    for p in products:
        frags = frags_per_product.get(p["product_code"])
        if frags is None:
            continue
        kept = [f for f in frags if f not in common]
        p["promotion"] = "; ".join(kept) if kept else None
    return sorted(common)


def fill_null_specs(products):
    """Mục 7: thông số không tồn tại LUÔN giữ key = null theo union key của category."""
    keys_by_cat = defaultdict(set)
    for p in products:
        keys_by_cat[p["category"]].update(p["specs"].keys())
    for p in products:
        for k in keys_by_cat[p["category"]]:
            p["specs"].setdefault(k, None)


def seed_stock(product_code: str):
    """Seed tồn kho demo (deterministic) — admin dashboard sẽ chỉnh lại qua PATCH."""
    h = int(hashlib.md5(product_code.encode()).hexdigest(), 16)
    qty = h % 37  # 0..36, ~3% hết hàng
    return qty, "in_stock" if qty > 0 else "out_of_stock"


def run():
    raw = json.load(open(config.RAW_PRODUCTS_JSON, encoding="utf-8"))
    report = {
        "total_input": len(raw),
        "dropped_missing_required": 0,
        "duplicate_product_id": 0,
        "missing_original_price": 0,
        "missing_name": 0,
        "unmapped_source_fields": 0,
        "conflicts": 0,
        "sale_gt_original": 0,
    }
    conflicts = []

    known_src = set(FIELD_MAP) | {
        "time_crawler", "category_id", "category_name", "product_id",
        "producttype", "brand", "quantity_sold", "promotion",
    }
    products, by_id = [], {}
    for r in raw:
        unmapped = set(r.keys()) - known_src
        report["unmapped_source_fields"] += len(unmapped)
        p = normalize_product(r)
        if p["original_price"] is None:
            report["missing_original_price"] += 1
        if p["product_name"] is None:
            report["missing_name"] += 1
        # Mục 25 extract_data + mục 10: bắt buộc product_id, name, category, original_price
        if not all([p["product_id"], p["product_code"], p["product_name"],
                    p["category"], p["original_price"]]):
            report["dropped_missing_required"] += 1
            continue
        if p["sale_price"] and p["sale_price"] > p["original_price"]:
            report["sale_gt_original"] += 1
            p["sale_price"] = None  # không cho sale > gốc lọt qua pipeline
        # Dedup theo product_id: giữ bản updated_at mới hơn, log conflict (mục 8)
        old = by_id.get(p["product_id"])
        if old is not None:
            report["duplicate_product_id"] += 1
            if (old["product_name"] != p["product_name"]
                    or old["product_code"] != p["product_code"]):
                report["conflicts"] += 1
                conflicts.append({
                    "product_id": p["product_id"],
                    "kept": None,  # điền bên dưới
                    "a": {"name": old["product_name"], "code": old["product_code"],
                          "updated_at": old["source"]["updated_at"]},
                    "b": {"name": p["product_name"], "code": p["product_code"],
                          "updated_at": p["source"]["updated_at"]},
                })
            newer = p if (p["source"]["updated_at"] or "") >= (old["source"]["updated_at"] or "") else old
            if conflicts and conflicts[-1].get("kept") is None:
                conflicts[-1]["kept"] = newer["source"]["updated_at"]
            by_id[p["product_id"]] = newer
        else:
            by_id[p["product_id"]] = p

    products = list(by_id.values())
    # product_code phải duy nhất (khóa hệ thống) — nếu trùng giữ bản mới hơn
    by_code = {}
    for p in products:
        old = by_code.get(p["product_code"])
        if old and (old["source"]["updated_at"] or "") >= (p["source"]["updated_at"] or ""):
            continue
        by_code[p["product_code"]] = p
    products = list(by_code.values())

    common_vouchers = split_common_vouchers(products)
    fill_null_specs(products)

    report["total_valid"] = len(products)
    report["success"] = (
        report["total_valid"] > 0
        and all(p["original_price"] > 0 for p in products)
        and not any(p["sale_price"] and p["sale_price"] > p["original_price"] for p in products)
    )

    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.PROCESSED_DIR / "products.json", "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False)
    with open(config.PROCESSED_DIR / "promotions.json", "w", encoding="utf-8") as f:
        json.dump({p["product_code"]: p["promotion"] for p in products if p["promotion"]},
                  f, ensure_ascii=False, indent=1)
    with open(config.PROCESSED_DIR / "policies.json", "w", encoding="utf-8") as f:
        json.dump({"common_vouchers": common_vouchers}, f, ensure_ascii=False, indent=1)
    with open(config.REPORTS_DIR / "data_validation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    with open(config.REPORTS_DIR / "data_conflicts.json", "w", encoding="utf-8") as f:
        json.dump(conflicts, f, ensure_ascii=False, indent=1)

    load_sqlite(products)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    print(f"common_vouchers: {len(common_vouchers)}")


def load_sqlite(products):
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    with db.cursor(write=True) as cur:
        cur.execute("DELETE FROM products")
        for p in products:
            qty, status = seed_stock(p["product_code"])
            cur.execute(
                """INSERT OR REPLACE INTO products
                   (product_code, source_product_id, category, category_label, device_type,
                    product_name, brand, original_price, sale_price, rating, review_count,
                    review_summary, quantity_sold, stock_quantity, stock_status, promotion,
                    warranty, color, accessories, outstanding_features, specs, image_url,
                    product_url, online_sale_only, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (p["product_code"], p["product_id"], p["category"], p["category_label"],
                 p["device_type"], p["product_name"], p["brand"], p["original_price"],
                 p["sale_price"], p["rating"], None, None, p["quantity_sold"],
                 qty, status, p["promotion"], p["warranty"], p["color"], p["accessories"],
                 p["outstanding_features"], json.dumps(p["specs"], ensure_ascii=False),
                 p["image_url"], p["product_url"], int(p["online_sale_only"]),
                 p["source"]["updated_at"] or now),
            )


if __name__ == "__main__":
    run()
