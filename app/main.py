"""FastAPI app chính — deploy với docs_url=None (deploy.md: /docs → 404).

Chạy:  uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
import asyncio
import contextlib
import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import config
from app.routers import admin
from app.services import alerts, orchestrator, ws_manager
from app.tools import registry


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = [asyncio.create_task(alerts.polling_loop()),      # LỚP 2 polling 60s
             asyncio.create_task(ws_manager.heartbeat_loop())]  # PING 30s
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.include_router(admin.router)


@app.exception_handler(Exception)
async def internal_error(request, exc):
    # Không hiển thị lỗi kỹ thuật thô cho người dùng (admin_interface.md mục 8)
    return JSONResponse(status_code=500, content={
        "error": True, "code": "INTERNAL_ERROR",
        "message": "Hệ thống gặp lỗi, vui lòng thử lại"})


# ── Chat API ───────────────────────────────────────────────────────

class ChatBody(BaseModel):
    customer_id: str | None = None
    message: str


@app.post("/api/chat")
async def chat(body: ChatBody):
    if not body.message or not body.message.strip():
        raise HTTPException(422, detail="Tin nhắn trống")
    customer_id = body.customer_id or str(uuid.uuid4())
    result = await orchestrator.handle_chat(customer_id, body.message.strip())
    result["customer_id"] = customer_id
    return result


# ── Demo trigger (nội bộ — curl/Postman, KHÔNG expose ra UI khách) ─

class TriggerBody(BaseModel):
    customer_id: str
    product_id: str
    alert_type: str = "PRICE_DROP"


@app.post("/demo/trigger-alert")
async def trigger_alert(body: TriggerBody):
    if body.alert_type not in ("PRICE_DROP", "BACK_IN_STOCK"):
        raise HTTPException(422, detail="alert_type: PRICE_DROP | BACK_IN_STOCK")
    if not registry.product_exists(body.product_id):
        raise HTTPException(404, detail="PRODUCT_NOT_FOUND")
    res = await alerts.force_alert(body.customer_id, body.product_id, body.alert_type)
    return {"success": res is not None, "alert_id": res[0] if res else None,
            "pushed_via_websocket": bool(res and res[1])}


# ── WebSocket ──────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, customer_id: str = ""):
    if not customer_id:
        await ws.close(code=4000)
        return
    await ws_manager.connect(customer_id, ws)
    try:
        while True:
            await ws.receive_text()  # giữ kết nối; client không cần gửi gì
    except WebSocketDisconnect:
        ws_manager.disconnect(customer_id, ws)


# ── Frontend (SPA — gateway/chat/admin đều là view phía client của
#    CÙNG 1 URL, deploy chỉ lộ ra "/") ───────────────────────────────

WEBAPP_DIST_DIR = config.SRC_DIR / "Frontend" / "webapp" / "dist"

app.mount("/assets", StaticFiles(directory=WEBAPP_DIST_DIR / "assets"), name="assets")


@app.get("/")
def index():
    return FileResponse(WEBAPP_DIST_DIR / "index.html")
