"""WebSocket manager — kết nối wss://{host}/ws?customer_id=..., PING 30s (API_contract.md mục 4)."""
import asyncio
import json
from datetime import datetime

from fastapi import WebSocket

from app import config

_connections: dict[str, list[WebSocket]] = {}


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


async def connect(customer_id: str, ws: WebSocket) -> None:
    await ws.accept()
    _connections.setdefault(customer_id, []).append(ws)
    await ws.send_text(json.dumps(
        {"type": "CONNECTED", "customer_id": customer_id, "timestamp": _now()},
        ensure_ascii=False))


def disconnect(customer_id: str, ws: WebSocket) -> None:
    conns = _connections.get(customer_id, [])
    if ws in conns:
        conns.remove(ws)
    if not conns:
        _connections.pop(customer_id, None)


async def push(customer_id: str, payload: dict) -> bool:
    """Push tới đúng customer_id đang online. Trả về True nếu có kết nối nhận."""
    sent = False
    for ws in list(_connections.get(customer_id, [])):
        try:
            await ws.send_text(json.dumps(payload, ensure_ascii=False))
            sent = True
        except Exception:
            disconnect(customer_id, ws)
    return sent


async def broadcast(payload: dict) -> int:
    """Push tới TẤT CẢ khách đang online (khuyến mãi áp dụng cho mọi người)."""
    text = json.dumps(payload, ensure_ascii=False)
    sent = 0
    for customer_id in list(_connections):
        for ws in list(_connections.get(customer_id, [])):
            try:
                await ws.send_text(text)
                sent += 1
            except Exception:
                disconnect(customer_id, ws)
    return sent


async def heartbeat_loop():
    """PING mỗi 30s tới mọi kết nối."""
    while True:
        await asyncio.sleep(config.WS_PING_INTERVAL_SECONDS)
        payload = json.dumps({"type": "PING", "timestamp": _now()})
        for customer_id in list(_connections):
            for ws in list(_connections.get(customer_id, [])):
                try:
                    await ws.send_text(payload)
                except Exception:
                    disconnect(customer_id, ws)
