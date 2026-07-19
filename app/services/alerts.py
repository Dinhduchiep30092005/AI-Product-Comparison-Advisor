"""Alert 2 lớp (Flow_scheduler_alert_WebSocket.md):
- LỚP 1 event-driven: admin PATCH giá/tồn kho → check_alert(product_id) ngay lập tức.
- LỚP 2 polling 60s: quét products_discussed của MỌI customer (dự phòng nguồn ngoài).
Dedup theo {customer_id}:{product_id}:{alert_type} → push WebSocket tới đúng customer.
"""
import asyncio
import uuid
from datetime import datetime

from app import config, db
from app.services import memory, ws_manager
from app.tools import cache


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _should_skip(dedup_key: str, cand: dict) -> bool:
    """Dedup: bỏ qua nếu đã báo alert này rồi — TRỪ khi thay đổi đáng kể
    (giá mới lệch ≥5% so với giá của alert trước) thì báo lại."""
    with db.cursor() as cur:
        cur.execute("SELECT new_price FROM alerts WHERE dedup_key=?", (dedup_key,))
        row = cur.fetchone()
    if row is None:
        return False
    old_alert_price, new_price = row["new_price"], cand.get("new_price")
    if old_alert_price and new_price and abs(new_price - old_alert_price) / old_alert_price >= 0.05:
        with db.cursor(write=True) as cur:
            cur.execute("DELETE FROM alerts WHERE dedup_key=?", (dedup_key,))
        return False
    return True


def _current_state(product_id: str):
    with db.cursor() as cur:
        cur.execute("SELECT product_name, sale_price, original_price, stock_status "
                    "FROM products WHERE product_code=?", (product_id,))
        row = cur.fetchone()
    if row is None:
        return None
    price = row["sale_price"] if row["sale_price"] is not None else row["original_price"]
    return {"product_name": row["product_name"], "price": price,
            "stock_status": row["stock_status"]}


def _detect(entry: dict, state: dict) -> list[dict]:
    """So sánh giá/tồn kho hiện tại với lúc tư vấn → danh sách alert ứng viên."""
    found = []
    old_price = entry.get("price_at_advice")
    if old_price and state["price"] and state["price"] < old_price:
        pct = round((old_price - state["price"]) / old_price * 100)
        found.append({"alert_type": "PRICE_DROP",
                      "message": f"Giá đã giảm {pct}% so với lúc tư vấn",
                      "old_price": old_price, "new_price": state["price"]})
    if (entry.get("stock_status_at_advice") == "out_of_stock"
            and state["stock_status"] == "in_stock"):
        found.append({"alert_type": "BACK_IN_STOCK",
                      "message": "Sản phẩm đã có hàng trở lại",
                      "old_price": None, "new_price": None})
    return found


async def _store_and_push(customer_id: str, product_id: str, state: dict,
                          cand: dict) -> tuple[str, bool] | None:
    dedup_key = f"{customer_id}:{product_id}:{cand['alert_type']}"
    if _should_skip(dedup_key, cand):
        return None
    alert_id = "ALT_" + uuid.uuid4().hex[:6].upper()
    now = _now()
    with db.cursor(write=True) as cur:
        cur.execute(
            "INSERT INTO alerts (alert_id,dedup_key,customer_id,product_id,product_name,"
            "alert_type,message,old_price,new_price,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (alert_id, dedup_key, customer_id, product_id, state["product_name"],
             cand["alert_type"], cand["message"], cand["old_price"], cand["new_price"], now))
    sent = await ws_manager.push(customer_id, {
        "type": "ALERT", "alert_id": alert_id, "priority": "HIGH",
        "customer_id": customer_id, "product_id": product_id,
        "product_name": state["product_name"], "alert_type": cand["alert_type"],
        "message": cand["message"], "old_price": cand["old_price"],
        "new_price": cand["new_price"],
        "source": {"system": "Product_API", "fetched_at": now}, "created_at": now,
    })
    return alert_id, sent


async def check_alert(product_id: str) -> list[str]:
    """LỚP 1 — gọi ngay sau khi giá/tồn kho đổi. Trả về danh sách alert_id đã push."""
    state = _current_state(product_id)
    if state is None:
        return []
    pushed = []
    for cust in memory.all_customers_with_products():
        for entry in cust["products_discussed"]:
            if entry.get("product_id") != product_id:
                continue
            for cand in _detect(entry, state):
                res = await _store_and_push(cust["customer_id"], product_id, state, cand)
                if res:
                    pushed.append(res[0])
    return pushed


def _force_cand(alert_type: str, state: dict, message: str | None) -> dict:
    if alert_type == "PRICE_DROP":
        old = int(state["price"] * 1.18) if state["price"] else None
        return {"alert_type": "PRICE_DROP",
                "message": message or "Giá đã giảm 18% so với lúc tư vấn",
                "old_price": old, "new_price": state["price"]}
    return {"alert_type": "BACK_IN_STOCK",
            "message": message or "Sản phẩm đã có hàng trở lại",
            "old_price": None, "new_price": None}


def _apply_to_product(product_id: str, alert_type: str, message: str) -> None:
    """Ghi nhận thay đổi THẬT vào products — nếu chỉ bắn alert mà không cập
    nhật data, chatbot tư vấn SAU đó vẫn đọc dữ liệu cũ (VD báo "không có
    khuyến mãi") dù khách vừa nhận thông báo KM qua WebSocket, gây mâu thuẫn."""
    if alert_type == "PRICE_DROP":
        with db.cursor(write=True) as cur:
            cur.execute("UPDATE products SET promotion=? WHERE product_code=?",
                       (message, product_id))
    else:  # BACK_IN_STOCK
        with db.cursor(write=True) as cur:
            cur.execute(
                "UPDATE products SET stock_status='in_stock', "
                "stock_quantity=CASE WHEN COALESCE(stock_quantity,0)<=0 THEN 10 "
                "ELSE stock_quantity END WHERE product_code=?", (product_id,))
    cache.invalidate(product_id)


async def force_alert(customer_id: str, product_id: str, alert_type: str,
                      message: str | None = None):
    """POST /demo/trigger-alert — bỏ qua điều kiện thật + dedup, push thẳng.

    `message` cho phép admin (tab Khuyến mãi) tự soạn nội dung chương trình
    thay vì dùng câu mặc định — dùng chung cơ chế alert/WebSocket có sẵn."""
    state = _current_state(product_id)
    if state is None:
        return None
    cand = _force_cand(alert_type, state, message)
    _apply_to_product(product_id, alert_type, cand["message"])
    dedup_key = f"{customer_id}:{product_id}:{alert_type}"
    with db.cursor(write=True) as cur:  # xoá dedup cũ để demo bắn lại được nhiều lần
        cur.execute("DELETE FROM alerts WHERE dedup_key=?", (dedup_key,))
    return await _store_and_push(customer_id, product_id, state, cand)


async def force_alert_broadcast(product_id: str, alert_type: str,
                                message: str | None = None):
    """Khuyến mãi áp dụng cho TẤT CẢ khách hàng — bắn qua WebSocket cho
    mọi kết nối đang online, không giới hạn theo customer_id."""
    state = _current_state(product_id)
    if state is None:
        return None
    cand = _force_cand(alert_type, state, message)
    _apply_to_product(product_id, alert_type, cand["message"])
    alert_id = "ALT_" + uuid.uuid4().hex[:6].upper()
    now = _now()
    dedup_key = f"ALL:{product_id}:{alert_type}"
    with db.cursor(write=True) as cur:
        cur.execute("DELETE FROM alerts WHERE dedup_key=?", (dedup_key,))
        cur.execute(
            "INSERT INTO alerts (alert_id,dedup_key,customer_id,product_id,product_name,"
            "alert_type,message,old_price,new_price,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (alert_id, dedup_key, "ALL", product_id, state["product_name"],
             cand["alert_type"], cand["message"], cand["old_price"], cand["new_price"], now))
    sent = await ws_manager.broadcast({
        "type": "ALERT", "alert_id": alert_id, "priority": "HIGH",
        "customer_id": "ALL", "product_id": product_id,
        "product_name": state["product_name"], "alert_type": cand["alert_type"],
        "message": cand["message"], "old_price": cand["old_price"],
        "new_price": cand["new_price"],
        "source": {"system": "Product_API", "fetched_at": now}, "created_at": now,
    })
    return alert_id, sent > 0


async def polling_loop():
    """LỚP 2 — chạy nền mỗi 60s, quét mọi products_discussed."""
    while True:
        await asyncio.sleep(config.POLL_INTERVAL_SECONDS)
        try:
            seen: set[str] = set()
            for cust in memory.all_customers_with_products():
                for entry in cust["products_discussed"]:
                    pid = entry.get("product_id")
                    if pid and pid not in seen:
                        seen.add(pid)
                        await check_alert(pid)
        except Exception:
            pass  # polling dự phòng không được chết vì 1 lỗi lẻ
