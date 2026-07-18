"""Registry 5 MCP tool (tool_spec.md + API_contract.md mục 2) — logic dùng chung cho:
- Luồng A: Orchestrator gọi trực tiếp song song (enrich top sản phẩm)
- Luồng B: LLM tool-calling (qua specs.py)

Mọi tool read-only. KHÔNG BAO GIỜ trả cost_price (không tồn tại trong hệ thống).
Validate product_id (= product_code chuẩn hoá) tồn tại trong catalog trước khi trả dữ liệu.
"""
from datetime import datetime

from app import config, db
from app.tools import cache


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _get_product(product_id: str):
    with db.cursor() as cur:
        cur.execute("SELECT * FROM products WHERE product_code=?", (product_id,))
        row = cur.fetchone()
    return db.row_to_dict(row) if row else None


def product_exists(product_id: str) -> bool:
    return _get_product(product_id) is not None


def get_product_price(product_id: str) -> dict:
    cached = cache.get(product_id, "price")
    if cached:
        return cached
    p = _get_product(product_id)
    if p is None:
        return {"product_id": product_id, "price": None, "error": "MISSING_DATA"}
    result = {
        "product_id": product_id,
        "price": p["sale_price"] if p["sale_price"] is not None else p["original_price"],
        "original_price": p["original_price"],
        "currency": "VND",
        "timestamp": _now(),
    }
    if result["price"] is None:
        result = {"product_id": product_id, "price": None, "error": "MISSING_DATA"}
    cache.put(product_id, "price", result)
    return result


def get_product_stock(product_id: str, store_id: str | None = None) -> dict:
    cached = cache.get(product_id, "stock")
    if cached:
        return cached
    p = _get_product(product_id)
    if p is None or p["stock_quantity"] is None:
        return {"product_id": product_id, "stock_quantity": None, "error": "MISSING_DATA"}
    result = {
        "product_id": product_id,
        "stock_quantity": p["stock_quantity"],
        "status": p["stock_status"] or ("in_stock" if p["stock_quantity"] > 0 else "out_of_stock"),
        "store_id": store_id,
        "timestamp": _now(),
    }
    cache.put(product_id, "stock", result)
    return result


def get_product_promotion(product_id: str) -> dict:
    cached = cache.get(product_id, "promotion")
    if cached:
        return cached
    p = _get_product(product_id)
    if p is None:
        return {"product_id": product_id, "promotion_text": None, "error": "MISSING_DATA"}
    result = {
        "product_id": product_id,
        "promotion_text": p["promotion"],
        "discount_percent": None,
        "expiry": None,
        "timestamp": _now(),
    }
    cache.put(product_id, "promotion", result)
    return result


def get_product_review(product_id: str) -> dict:
    cached = cache.get(product_id, "review")
    if cached:
        return cached
    p = _get_product(product_id)
    if p is None:
        return {"product_id": product_id, "rating": None, "error": "MISSING_DATA"}
    result = {
        "product_id": product_id,
        "rating": p["rating"],
        "review_count": p["review_count"],
        "summary": p["review_summary"],
        "timestamp": _now(),
    }
    cache.put(product_id, "review", result)
    return result


def search_policy(query: str, policy_type: str | None = None) -> dict:
    """Tra cứu chính sách từ policy_collection (vector) — validate policy_type theo taxonomy."""
    if policy_type is not None and policy_type not in config.POLICY_TYPES:
        return {"results": [], "error": "INVALID_PARAMS",
                "message": f"policy_type không hợp lệ, chọn 1 trong: {config.POLICY_TYPES}"}
    from app.services import rag  # import trễ: tránh load model khi chỉ dùng 4 tool kia
    results = rag.search_policy_chunks(query, policy_type=policy_type, top_k=4)
    return {"results": results}


# Toàn bộ tool đều read-only → auto-exec, không cần Pending Action (Flow_agent_loop.md)
AUTO_EXECUTABLE = {
    "get_product_price": get_product_price,
    "get_product_stock": get_product_stock,
    "get_product_promotion": get_product_promotion,
    "get_product_review": get_product_review,
    "search_policy": search_policy,
}


def call_tool(name: str, args: dict) -> dict:
    """Entry point duy nhất cho Luồng B — validate tên tool + args trước khi execute."""
    fn = AUTO_EXECUTABLE.get(name)
    if fn is None:
        return {"error": "INVALID_PARAMS", "message": f"Tool không tồn tại: {name}"}
    if name == "search_policy":
        query = args.get("query")
        if not query:
            return {"error": "INVALID_PARAMS", "message": "search_policy cần query"}
        return fn(query, args.get("policy_type"))
    product_id = args.get("product_id")
    if not product_id or not product_exists(str(product_id)):
        return {"error": "PRODUCT_NOT_FOUND",
                "message": f"product_id không tồn tại trong catalog: {product_id}"}
    if name == "get_product_stock":
        return fn(str(product_id), args.get("store_id"))
    return fn(str(product_id))
