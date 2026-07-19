# AI Product Comparison Advisor

Chatbot tư vấn & so sánh sản phẩm điện máy bằng tiếng Việt tự nhiên (có dấu/không dấu), dựa trên nhu cầu thật của khách — không bịa giá, tồn kho, khuyến mãi hay thông số. Mọi câu trả lời đều có nguồn dữ liệu (catalog / real-time API / chính sách) đi kèm.

Đề bài gốc: xem [`Pipeline/Request.md`](Pipeline/Request.md).

## Kiến trúc tổng quan

```
Khách hỏi (tiếng Việt, có thể không dấu)
      ↓
Slot-filling (trích nhu cầu: category, budget, room_size, usage_priority...)
      ↓ thiếu thông tin quan trọng → hỏi lại (tối đa 2 vòng)
Vector search (ChromaDB) + rerank (bge-reranker-v2-m3)
      ↓
Domain Rule Engine (hard filter + chấm điểm theo ngành hàng — thuần code, không qua LLM)
      ↓
Enrich real-time song song (giá/tồn kho/khuyến mãi/review qua MCP tool)
      ↓
LLM sinh câu trả lời có cấu trúc (DeepSeek-V4-Flash) — so sánh chéo, dịch thông số
thành lợi ích, luôn có CTA gợi mở
      ↓
Guardrail đối chiếu từng claim với dữ liệu thật (rule-based, không gọi lại LLM)
      ↓
Trả lời khách: top 3 sản phẩm + trade-off + nguồn dữ liệu cho từng claim
```

Câu hỏi tự do ngoài luồng so sánh (hỏi thêm 1 sản phẩm, hỏi chính sách...) đi qua **Luồng B** — LLM tool-calling loop, có fallback keyword routing khi tool-calling lỗi kỹ thuật.

Song song có 1 tiến trình nền độc lập: phát hiện giá giảm/hàng về lại và đẩy thông báo real-time qua WebSocket.

Tài liệu kiến trúc chi tiết (nguồn tham chiếu chính, luôn đối chiếu code khi có thay đổi):

| File | Nội dung |
|---|---|
| [`Flow_general.md`](Flow_general.md) | Tổng quan toàn bộ luồng xử lý 1 lượt chat, bước 0→9 |
| [`Pipeline/Flow_slot_filling.md`](Pipeline/Flow_slot_filling.md) | Trích slot, schema critical theo từng category (19 category Nhóm 1 + Nhóm 2) |
| [`Pipeline/Flow_RAG.md`](Pipeline/Flow_RAG.md) | Vector search, rerank, Domain Rule Engine, sinh câu trả lời, guardrail |
| [`Pipeline/Flow_agent_loop.md`](Pipeline/Flow_agent_loop.md) | Luồng câu hỏi tự do (tool-calling + fallback keyword) |
| [`Pipeline/Flow_MCP.md`](Pipeline/Flow_MCP.md) | Cách gọi dữ liệu real-time (giá/tồn kho/KM/review) |
| [`Pipeline/tool/tool_spec.md`](Pipeline/tool/tool_spec.md) | Bảng định nghĩa 5 MCP tool |
| [`Pipeline/memory/flow_customer_memory.md`](Pipeline/memory/flow_customer_memory.md) | Ghi nhớ khách qua nhiều lần quay lại |
| [`Pipeline/memory/Flow_scheduler_alert_WebSocket.md`](Pipeline/memory/Flow_scheduler_alert_WebSocket.md) | Alert giá giảm/hàng về lại real-time |
| [`Pipeline/utils/log_masking.md`](Pipeline/utils/log_masking.md) | Che thông tin nhạy cảm (SĐT, email...) trước khi ghi log |
| [`Pipeline/Demo/deploy.md`](Pipeline/Demo/deploy.md) | Phương án deploy để nộp bài (docs tắt, gọi API bằng Postman/curl) |
| [`Data/Data product/data_normalization.md`](Data/Data%20product/data_normalization.md) | Chuẩn hoá dữ liệu sản phẩm về schema chung |
| [`Data/Data policy/flow_data_policy.md`](Data/Data%20policy/flow_data_policy.md) | Admin upload/ingest tài liệu chính sách |
| [`API/API_contract.md`](API/API_contract.md) | Contract request/response đầy đủ giữa Frontend ↔ Backend ↔ MCP ↔ WebSocket |

## Công nghệ chính

- **Backend**: Python, FastAPI (`app/main.py`), SQLite (dữ liệu runtime: sản phẩm, customer_memory, chính sách, alert)
- **LLM**: DeepSeek-V4-Flash qua FPT AI Marketplace (OpenAI-compatible), fallback `gpt-oss-120b`
- **Vector store**: ChromaDB — `catalog_collection` (sản phẩm) + `policy_collection` (chính sách)
- **Embedding**: `Vietnamese_Embedding` · **Reranker**: `bge-reranker-v2-m3` — cả 2 gọi qua FPT AI Factory API (cùng provider/key với LLM), KHÔNG load model cục bộ (tránh footprint RAM torch/sentence-transformers ~3.2GB, vượt free tier môi trường deploy)
- **Frontend**: 1 SPA duy nhất (React 19 + Vite + Tailwind 4) tại `Frontend/webapp/`, gộp 3 màn hình — cổng vào (chọn khách hàng/đăng nhập admin), chat khách hàng, dashboard admin — build ra `dist/` và được FastAPI serve tại `/` (deploy chỉ lộ ra **1 URL duy nhất**, không có route `/admin-ui` riêng)

## Cấu trúc thư mục

```
app/
  main.py              FastAPI app (/api/chat, /ws, /demo/trigger-alert, serve SPA tại "/")
  config.py            Toàn bộ hằng số/biến môi trường tập trung
  db.py                Schema + kết nối SQLite
  pipeline/             normalize.py (chuẩn hoá dữ liệu) · ingest_vectors.py (embed vào ChromaDB) · seed_demo.py
  services/             orchestrator, slot_filling, rag, rule_engine, agent_loop, enrich,
                         guardrail, memory, session, alerts, embeddings, llm, audit, ws_manager
  tools/                5 MCP tool (get_product_price/stock/promotion/review, search_policy)
  routers/admin.py      Admin API (đăng nhập, quản lý sản phẩm, chính sách, demo trigger)
  tests/                Test tự động (pytest)
API/                    API contract, API key mẫu
Data/                    Dữ liệu sản phẩm/chính sách gốc + tài liệu chuẩn hoá
Pipeline/                Toàn bộ tài liệu kiến trúc theo từng luồng
Frontend/
  webapp/               SPA React 19 + Vite + Tailwind 4 (gateway + chat + admin, build ra dist/)
  entry interface/       Nguồn thiết kế Figma Make gốc (cổng vào) — tham chiếu, không deploy trực tiếp
  user interface/        Nguồn thiết kế Figma Make gốc (chat khách hàng) — tham chiếu
  admin interface/       Nguồn thiết kế Figma Make gốc (admin dashboard) — tham chiếu
```

## Chạy thử

### 1. Cài dependency

```bash
pip install -r app/requirements.txt
```

### 2. Cấu hình `.env`

Tạo `app/.env` (tham khảo `API/API_Key.md`):

```
API_KEY_FPT=<api-key>
LLM_MODEL=DeepSeek-V4-Flash
LLM_FALLBACK_MODEL=gpt-oss-120b
EMBEDDING_MODEL=Vietnamese_Embedding
RERANKER_MODEL=bge-reranker-v2-m3
```

### 3. Chuẩn hoá dữ liệu + nạp vector store (chạy 1 lần, hoặc lại khi catalog/chính sách đổi)

```bash
python -m app.pipeline.normalize        # products_detail.json -> data/processed/*.json + SQLite
python -m app.pipeline.ingest_vectors   # embed catalog + policy vào ChromaDB
python -m app.pipeline.seed_demo        # seed customer_memory demo (demo_001, demo_002)
```

### 4. Build frontend

```bash
cd Frontend/webapp
npm install
npm run build        # tạo Frontend/webapp/dist/ — FastAPI serve thư mục này tại "/"
cd ../..
```

### 5. Chạy server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000/` — **1 URL duy nhất**: chọn "Khách hàng" để vào chat SmartBot, hoặc đăng nhập admin (tài khoản mặc định `admin`/`admin123`, đổi qua `ADMIN_USERNAME`/`ADMIN_PASSWORD`) ngay trên cùng trang để vào dashboard quản trị — không có route `/admin-ui` riêng.

`docs_url`/`redoc_url`/`openapi_url` đều tắt theo chủ đích (xem `Pipeline/Demo/deploy.md`) — gọi API trực tiếp bằng Postman/curl theo `API/API_contract.md`, không có Swagger UI.

Khi phát triển frontend, có thể chạy `npm run dev` trong `Frontend/webapp/` (Vite dev server, port 5173, tự proxy `/api`, `/admin`, `/demo`, `/ws` sang `:8000`) song song với backend để có hot reload.

### 6. Chạy test

```bash
python -m pytest app/tests/
```

### 7. Deploy bằng Docker (Render/on-premise)

```bash
docker build -t smartbot .
docker run -p 8000:8000 --env-file app/.env smartbot
```

Bước 3+4 (chuẩn hoá dữ liệu + build frontend) **PHẢI chạy trước** ở máy dev —
`app/data/app.db` và `app/data/chroma` được commit thẳng vào git rồi `COPY`
nguyên vào image lúc build (Render free tier không đủ tài nguyên/thời gian để
tự re-ingest lúc container khởi động). `.dockerignore` phải khớp với
`.gitignore`: KHÔNG được loại trừ `app/data/app.db` hay `app/data/chroma` —
từng có bug thực tế loại nhầm 2 thứ này khỏi Docker build context, khiến
container deploy lên với database rỗng dù data vẫn nằm đúng trong git (chi
tiết xem `Pipeline/Demo/deploy.md`).

## Nguyên tắc cốt lõi cần nhớ khi sửa code

- **Không bịa dữ liệu**: mọi số liệu trả về khách phải bám theo `product_code` + `field_name` + `source_type` (`catalog` | `realtime` | `policy`) để guardrail đối chiếu được; thiếu dữ liệu → nói rõ, không suy đoán.
- **`product_code`** là định danh sản phẩm thống nhất toàn hệ thống (MCP tool, cache, ChromaDB metadata, customer_memory) — không phải `product_id` gốc crawl từ nguồn.
- **Category do LLM trích ra không được đi thẳng vào metadata filter** — luôn map qua bảng lookup `category_label` thật trong SQLite trước.
- **Ngưỡng cosine similarity** (`CATALOG_MIN_SIMILARITY`, `POLICY_MIN_SIMILARITY` trong `app/config.py`) đã hiệu chỉnh theo phân bố thực tế của model embedding đang dùng — đừng chỉnh về giá trị "trực giác" như 0.7-0.8 nếu chưa đo lại similarity thật của model.
- **`scores{}`/`comparison_table`** trong response lấy thẳng từ Domain Rule Engine, không tính lại/không qua LLM — tiêu chí nào sản phẩm thiếu spec thì bỏ qua, không điền rating giả.
- Session/citation (`recent_tool_results`, `citations`, `last_policy_chunks`, `last_enriched`) là dữ liệu **chỉ trong 1 lượt chat** — reset ở đầu mỗi lượt (`session.begin_turn`), không được rò rỉ sang lượt sau.
- **`session["last_top"]` phải reset khi đổi category** (`session.reset_need`) — nếu không, một tin nhắn tiếp theo không mang tiêu chí gì mới có thể vô tình hiển thị lại sản phẩm của nhu cầu CŨ dưới category mới (đã từng là bug thật: hỏi máy giặt sau khi vừa hỏi laptop ra lại đúng 3 laptop cũ).
- **KHÔNG nhét budget (số tiền) vào text query cho vector search/rerank** — budget chỉ lọc bằng structured metadata filter (`price ≤ budget×1.3`). Số "X triệu" trong text dễ trùng số ngẫu nhiên với thông số kỹ thuật khác (kg/HP/inch...), khiến embedding/rerank ưu tiên nhầm sản phẩm sai công suất/dung tích.
- **Top 3 hiển thị LUÔN khớp đúng kết quả Domain Rule Engine** — orchestrator không dựa vào việc LLM có nhắc đủ product_id trong JSON trả lời hay không để quyết định hiển thị bao nhiêu card (LLM bị bắt buộc viết đủ nội dung cho cả 3, không được tự ý lược bớt).
- **`llm.chat_json()` có `validate()` + retry** — dùng cho các câu trả lời JSON dài (so sánh nhiều sản phẩm, mỗi claim có citation) dễ bị model cắt cụt giữa chừng; luôn truyền `validate()` kiểm tra kết quả đủ nội dung mong đợi, không chỉ "parse được" là đủ.
- **5 MCP tool chỉ nhận `product_id`, không có tool tìm theo tên** — câu hỏi tự do (Luồng B) nhắc đích danh 1 sản phẩm chưa nằm trong `last_top` phải được orchestrator resolve tên → `product_id` bằng SQL LIKE TRƯỚC khi vào tool-calling loop (xem `mentioned_product_name` trong `Flow_slot_filling.md`).
