"""customer_memory (SQLite) — flow_customer_memory.md.

Ghi state đã tổng hợp (slots, products_discussed kèm giá lúc tư vấn, summary),
KHÔNG ghi full transcript thô.
"""
import json
from datetime import datetime

from app import db

MAX_SUMMARY_LINES = 5


def get(customer_id: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute("SELECT * FROM customer_memory WHERE customer_id=?", (customer_id,))
        row = cur.fetchone()
    if row is None:
        return None
    d = dict(row)
    d["slots_collected"] = json.loads(d["slots_collected"] or "{}")
    d["products_discussed"] = json.loads(d["products_discussed"] or "[]")
    return d


def save(customer_id: str, slots: dict, products_discussed: list, summary: str) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    with db.cursor(write=True) as cur:
        cur.execute(
            """INSERT INTO customer_memory
               (customer_id, slots_collected, products_discussed, conversation_summary, updated_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(customer_id) DO UPDATE SET
                 slots_collected=excluded.slots_collected,
                 products_discussed=excluded.products_discussed,
                 conversation_summary=excluded.conversation_summary,
                 updated_at=excluded.updated_at""",
            (customer_id, json.dumps(slots, ensure_ascii=False),
             json.dumps(products_discussed, ensure_ascii=False), summary, now))


def add_discussed(products_discussed: list, top_products: list[dict]) -> list:
    """Thêm top sản phẩm vừa tư vấn (kèm giá + tồn kho lúc tư vấn — dùng cho Alert)."""
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    by_id = {p["product_id"]: p for p in products_discussed}
    for p in top_products:
        by_id[p["product_code"]] = {
            "product_id": p["product_code"],
            "product_name": p["product_name"],
            "price_at_advice": p["sale_price"] if p["sale_price"] is not None else p["original_price"],
            "stock_status_at_advice": p.get("stock_status"),
            "discussed_at": now,
        }
    return list(by_id.values())


def append_summary(old_summary: str | None, line: str) -> str:
    lines = (old_summary or "").splitlines()
    lines.append(line)
    return "\n".join(lines[-MAX_SUMMARY_LINES:])


def all_customers_with_products() -> list[dict]:
    """Cho Alert Service: quét products_discussed của MỌI customer."""
    with db.cursor() as cur:
        cur.execute("SELECT customer_id, products_discussed FROM customer_memory")
        rows = cur.fetchall()
    out = []
    for r in rows:
        products = json.loads(r["products_discussed"] or "[]")
        if products:
            out.append({"customer_id": r["customer_id"], "products_discussed": products})
    return out
