"""Luồng A — Deterministic parallel enrich (Flow_MCP.md).

Orchestrator (code, KHÔNG qua LLM) gọi asyncio.gather() cho N product_id × 4 tool
CÙNG LÚC. Timeout riêng 1.5s/request — tổng thời gian = max(), không phải sum().
Lỗi/timeout → đánh dấu missing_data, KHÔNG chặn sản phẩm khác.
"""
import asyncio

from app import config
from app.tools import registry

_TOOLS = {
    "price": registry.get_product_price,
    "stock": registry.get_product_stock,
    "promotion": registry.get_product_promotion,
    "review": registry.get_product_review,
}


async def _call_one(fn, product_id: str):
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, product_id),
                                      timeout=config.ENRICH_TIMEOUT_SECONDS)
    except Exception:
        return {"product_id": product_id, "error": "MISSING_DATA"}


async def enrich_products(product_ids: list[str]) -> dict[str, dict]:
    """→ {product_id: {price: {...}, stock: {...}, promotion: {...}, review: {...}}}"""
    tasks, keys = [], []
    for pid in product_ids:
        for tool_name, fn in _TOOLS.items():
            tasks.append(_call_one(fn, pid))
            keys.append((pid, tool_name))
    results = await asyncio.gather(*tasks)
    out: dict[str, dict] = {pid: {} for pid in product_ids}
    for (pid, tool_name), res in zip(keys, results):
        out[pid][tool_name] = res
    return out
