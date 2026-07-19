"""Cấu hình tập trung — mọi hằng số/đường dẫn/biến môi trường đọc từ đây."""
import os
from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent
SRC_DIR = APP_DIR.parent

load_dotenv(APP_DIR / ".env")

# ── Đường dẫn dữ liệu ──────────────────────────────────────────────
DATA_DIR = APP_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
REPORTS_DIR = DATA_DIR / "reports"
CHROMA_DIR = DATA_DIR / "chroma"
LOG_DIR = DATA_DIR / "logs"
DB_PATH = DATA_DIR / "app.db"

RAW_PRODUCTS_JSON = SRC_DIR / "Data" / "Data product" / "products_detail.json"
POLICY_DOCS_DIR = SRC_DIR / "Data" / "Data policy"

# ── LLM (FPT AI Marketplace, OpenAI-compatible) ────────────────────
FPT_API_KEY = os.getenv("API_KEY_FPT", "")
FPT_BASE_URL = os.getenv("FPT_BASE_URL", "https://mkp-api.fptcloud.com")
LLM_MODEL = os.getenv("LLM_MODEL", "DeepSeek-V4-Flash")
LLM_FALLBACK_MODEL = os.getenv("LLM_FALLBACK_MODEL", "gpt-oss-120b")

# ── Embedding / Reranker — qua FPT AI Factory API (cùng provider/API key với
# LLM ở trên), KHÔNG load model cục bộ — tránh ~3.2GB RAM của torch/sentence-
# transformers, vốn vượt xa giới hạn free tier của môi trường deploy.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "Vietnamese_Embedding")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "bge-reranker-v2-m3")

# Cosine similarity tối thiểu để một vector result được phép đi tiếp vào câu trả lời.
# Có thể hiệu chỉnh theo model/dataset production mà không cần sửa code.
# Hiệu chỉnh thực nghiệm trên Vietnamese_Embedding + data hiện tại: match đúng
# chủ đề thường ra cosine ~0.38-0.5, câu hỏi/tài liệu lạc đề ~0.17-0.26 → 0.75
# (mặc định cũ) loại bỏ luôn cả kết quả đúng, khiến retrieval trả 0 candidate mọi lúc.
POLICY_MIN_SIMILARITY = float(os.getenv("POLICY_MIN_SIMILARITY", "0.35"))
CATALOG_MIN_SIMILARITY = float(os.getenv("CATALOG_MIN_SIMILARITY", "0.35"))

# ── Tham số flow (theo các file Flow_*.md) ─────────────────────────
CACHE_TTL_SECONDS = 60           # cache MCP tool (product_id, tool)
CATEGORY_CACHE_TTL_SECONDS = 300 # cache danh sách category (slot_filling), tự làm mới khi catalog re-ingest
ENRICH_TIMEOUT_SECONDS = 4.0     # timeout mỗi request Luồng A — đủ rộng để chịu được
                                  # hàng đợi thread pool khi có cuộc gọi LLM/embedding
                                  # nặng chạy cùng lúc (đọc SQLite tự nó rất nhanh,
                                  # 1.5s cũ từng gây báo nhầm MISSING_DATA khi bị nghẽn)
TOOL_CALL_MAX_ROUNDS = 3         # Luồng B tool-calling loop
TOOL_CALL_TIMEOUT_SECONDS = 45
TOOL_CALLING_ENABLED = os.getenv("TOOL_CALLING_ENABLED", "true").lower() == "true"
MAX_CLARIFY_ROUNDS = 2           # slot-filling
VECTOR_TOP_K = 20                # vector search top — cần dư dả vì nhiều model có nhiều SKU
                                  # gần trùng nhau (dedupe theo product_name ở rule_engine ăn bớt)
RERANK_TOP_K = 5                 # sau bge-reranker (mặc định; so sánh sản phẩm dùng top_k lớn hơn)
POLL_INTERVAL_SECONDS = 60       # Lớp 2 polling alert
WS_PING_INTERVAL_SECONDS = 30    # heartbeat WebSocket

# ── Admin ──────────────────────────────────────────────────────────
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# Taxonomy policy_type cố định (API_contract.md mục 2.5)
POLICY_TYPES = [
    "bảo_hành_đổi_trả",
    "giao_hàng_lắp_đặt",
    "bảo_mật_dữ_liệu",
    "điều_khoản_sử_dụng",
    "chăm_sóc_khách_hàng",
    "khác",
]

for _d in (DATA_DIR, PROCESSED_DIR, REPORTS_DIR, CHROMA_DIR, LOG_DIR):
    _d.mkdir(parents=True, exist_ok=True)
