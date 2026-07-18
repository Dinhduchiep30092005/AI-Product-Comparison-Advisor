# Mục đích: Định nghĩa cách hệ thống gọi dữ liệu real-time (giá/tồn kho/KM/review) qua MCP tool

## Luồng hoạt động: 2 luồng: Luồng A (code tự gọi song song 4 tool theo product_id, bắt buộc mọi lượt so sánh) và Luồng B (LLM tự chọn trong 5 tool, dùng cho câu hỏi tự do ngoài top-5)

### Input: product_id cần tra (từ Flow_RAG hoặc câu hỏi tự do), hoặc câu hỏi/policy_type cho search_policy

### Output: Giá/tồn kho/KM/review kèm timestamp + source metadata


LLM (DeepSeek-V4-Flash) discover tools từ MCP Server (Dùng MCP SDK: pip install mcp)
        ↓
LLM tự quyết định gọi tool nào (Description nói rõ: Mục đích - dùng khi nào - không dùng khi nào)
        Tool specs cho LLM: app/tools/specs.py — mirror MCP server,
        KHÔNG expose giá vốn/cost_price (Orchestrator lọc trước khi trả về LLM)
        Tối đa 3 vòng tool call; tool ngoài AUTO_EXECUTABLE không tự chạy
        → không hợp lệ/lỗi/timeout → trả lời "chưa có dữ liệu", không bịa

        Lưu ý: RIÊNG bước so sánh top-5 sau rerank (bắt buộc mọi lượt,
        không phải câu hỏi tự do): KHÔNG đi qua vòng lặp LLM tự chọn
        tool ở trên — vì cần chắc chắn cả 5 sản phẩm đều được enrich,
        không phụ thuộc LLM có "quyết định" gọi đủ hay không, và cần
        đảm bảo budget <5s (xem Flow_RAG.md).

        ┌─── Luồng A (Deterministic parallel enrich) ────────────────┐
        │ Orchestrator (code, KHÔNG qua LLM) tự gọi asyncio.gather() │
        │ cho cả 5 product_id × 4 tool (price/stock/promotion/       │
        │ review) CÙNG LÚC — cả 4 tool này đều nhận product_id làm   │
        │ input nên gọi batch song song được                         │
        │ → timeout riêng 1.5s/request, tổng thời gian = max(),      │
        │   không phải sum()                                         │
        │ → check session cache (product_id, tool) TTL 60s trước,    │
        │   cache hit thì bỏ qua request đó                          │
        │ → request timeout/lỗi → đánh dấu missing_data cho field    │
        │   đó, KHÔNG chặn 4 sản phẩm còn lại                        │
        │                                                            │
        │ Về "real-time" vs cache 60s: "real-time" nghĩa là dữ liệu  │
        │ luôn đọc từ nguồn sống (mock API do admin control), KHÔNG  │
        │ phải dữ liệu tĩnh bake vào ChromaDB — khác source_type=    │
        │ catalog. Cache 60s chỉ tối ưu tốc độ trong lượt hỏi liên   │
        │ tiếp về cùng sản phẩm, KHÔNG làm dữ liệu bị cũ vì admin    │
        │ update giá/tồn kho/review qua dashboard sẽ invalidate      │
        │ cache của đúng product_id đó ngay lập tức (xem             │
        │ flow_customer_memory.md phần admin UI) — độ trễ khách      │
        │ thấy dữ liệu mới gần như 0, không phải chờ hết 60s.        │
        └────────────────────────────────────────────────────────────┘

        ┌─── Luồng B (LLM tool-calling loop — giữ nguyên như trên) ─┐
        │ Dùng cho câu hỏi tự do giữa chừng, NGOÀI top-5, và cho    │
        │ search_policy (input là câu hỏi/policy_type, KHÔNG phải   │
        │ product_id nên không gộp vào batch Luồng A được)          │
        │ VD: "sản phẩm số 2 có trả góp không", hỏi thêm 1 sản phẩm │
        │ khác không nằm trong danh sách đã so sánh, hỏi chính sách │
        │ bảo hành rời                                              │
        └───────────────────────────────────────────────────────────┘
        ↓
MCP Server thực thi → gọi Product API thật (bọc API mock thành MCP tool:
GET {PRODUCT_API_BASE_URL}/products/{product_id}/price|stock|promotion|review —
endpoint thật cung cấp khi thi, dùng biến môi trường để dễ đổi)
        Validate product_id (= product_code sau chuẩn hóa) có tồn tại
        trong catalog trước khi gọi — tránh gọi API với id rác (riêng
        search_policy validate policy_type thay vì product_id)
        ↓
MCP Server stateless — Session Context (slot đã thu thập: category, budget,
room_size, priority...) thuộc Agent Orchestrator/Session Store,
KHÔNG thuộc MCP Server
        ↓
Trả structured result + source metadata (product_id, timestamp, tên field) về LLM
        ↓
LLM tổng hợp → Orchestrator build Source Citation cho từng claim
(giá này lấy từ API lúc nào, tồn kho theo kho nào, review lấy lúc nào) →
dùng cho guardrail check bước sau (xem Flow_RAG.md)