"""Seed customer_memory cho tài khoản demo (flow_customer_memory.md):
Khách A (demo_001) đã hỏi máy lạnh, Khách B (demo_002) đã hỏi tủ lạnh.

Chạy:  python -m app.pipeline.seed_demo
"""
from datetime import datetime

from app import db
from app.services import memory


def _top_products(category_label: str, n: int = 2) -> list[dict]:
    with db.cursor() as cur:
        cur.execute(
            """SELECT product_code, product_name, original_price, sale_price, stock_status
               FROM products WHERE category_label=? AND sale_price IS NOT NULL
               ORDER BY quantity_sold DESC LIMIT ?""", (category_label, n))
        return [dict(r) for r in cur.fetchall()]


def run():
    now = datetime.now().astimezone().isoformat(timespec="seconds")

    aircons = _top_products("Máy lạnh")
    memory.save(
        "demo_001",
        {"category": "Máy lạnh", "budget": 20000000, "room_size": 18,
         "noise_priority": "quiet", "usage_priority": ["energy_saving"]},
        [{"product_id": p["product_code"], "product_name": p["product_name"],
          "price_at_advice": p["sale_price"] or p["original_price"],
          "stock_status_at_advice": p["stock_status"], "discussed_at": now}
         for p in aircons],
        "Khách hỏi máy lạnh ~20 triệu cho phòng 18m², ưu tiên êm + tiết kiệm điện → tư vấn: "
        + ", ".join(p["product_name"][:40] for p in aircons))

    fridges = _top_products("Tủ lạnh")
    memory.save(
        "demo_002",
        {"category": "Tủ lạnh", "budget": 15000000, "household_size": 4,
         "usage_priority": ["energy_saving"]},
        [{"product_id": p["product_code"], "product_name": p["product_name"],
          "price_at_advice": p["sale_price"] or p["original_price"],
          "stock_status_at_advice": p["stock_status"], "discussed_at": now}
         for p in fridges],
        "Khách hỏi tủ lạnh ~15 triệu cho gia đình 4 người, ưu tiên tiết kiệm điện → tư vấn: "
        + ", ".join(p["product_name"][:40] for p in fridges))

    print("Đã seed demo_001 (máy lạnh):", [p["product_code"] for p in aircons])
    print("Đã seed demo_002 (tủ lạnh):", [p["product_code"] for p in fridges])


if __name__ == "__main__":
    run()
