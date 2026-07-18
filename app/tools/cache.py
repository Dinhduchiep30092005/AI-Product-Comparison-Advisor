"""Cache kết quả tool theo (product_id, tool) — TTL 60s (Flow_MCP.md).

Admin PATCH sản phẩm → invalidate(product_id) ngay lập tức (TTL bị huỷ sớm),
khách thấy dữ liệu mới gần như tức thời.
"""
import time

from app import config

_cache: dict[tuple[str, str], tuple[float, dict]] = {}


def get(product_id: str, tool: str):
    entry = _cache.get((product_id, tool))
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def put(product_id: str, tool: str, result: dict) -> None:
    _cache[(product_id, tool)] = (time.monotonic() + config.CACHE_TTL_SECONDS, result)


def invalidate(product_id: str) -> None:
    for key in [k for k in _cache if k[0] == product_id]:
        del _cache[key]
