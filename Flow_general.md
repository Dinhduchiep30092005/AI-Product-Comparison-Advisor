# Mục đích: Tổng quan kiến trúc của hệ thống

Khách vào chat (browser)
      ↓
0. Xác định customer_id
      ├── Tài khoản demo (giám khảo) → set customer_id cố định,
      │   dữ liệu customer_memory đã seed sẵn
      └── Khách thật → chưa có customer_id → sinh UUID, lưu cookie
      ↓
   Load customer_memory từ DB (slots đã biết, products_discussed,
   conversation_summary) → prepend vào session
      ↓
Khách gõ câu hỏi (tiếng Việt, có thể không dấu)
      ↓
1. Xử lý tiếng Việt (3 lớp: system prompt → RAG policy glossary →
   LLM tự suy luận từ context, không hiểu thì hỏi lại)
      ↓
2. Slot-filling (Flow_slot_filling.md)
      Structured extraction → merge vào session/customer_memory
      → Bao gồm nhận diện từ lóng/mô tả định tính (VD "pin trâu",
        "chụp đẹp", "chạy êm") map vào usage_priority theo category
        (cùng 1 lệnh gọi LLM, không tốn thêm round — chi tiết xem
        Flow_slot_filling.md mục 1b)
      → Với category="pc, máy in" hoặc "loa, tai nghe": thêm bước
        xác định device_type (đã suy ra sẵn lúc ingestion, nhưng
        nếu khách chưa nói rõ loại nào thì device_type là slot
        critical, phải hỏi)
      → Diff với slot schema theo category
      │
      ├── Thiếu slot critical → gộp câu hỏi, hỏi 1 lượt duy nhất
      │   (tối đa 2 vòng, quá thì dùng default + is_assumed=true)
      │   → trả lời khách, DỪNG ở đây, chờ lượt sau
      │
      └── Đủ slot → đi tiếp
      ↓
3. Truy xuất & rerank (Flow_RAG.md)
      Query construction: viết lại thành câu tự nhiên đầy đủ ngữ
      cảnh, gộp slot cứng (budget, room_size...) và GIỮ NGUYÊN cụm
      mô tả định tính (không rút gọn về từ khóa kỹ thuật) → giúp
      Vietnamese_Embedding match ngữ nghĩa slang với catalog
      → metadata pre-filter (category, price_range, device_type nếu
      có) → vector search catalog_collection (top 15-20) →
      bge-reranker-v2-m3 → top 5 candidate
      (nếu câu hỏi liên quan chính sách → song song search
      policy_collection)
      ↓
4. Domain Rule Engine (Flow_RAG.md — thuần code, không qua LLM)
      Lọc cứng (hard filter): loại sản phẩm không đáp ứng điều kiện
      bắt buộc (VD công suất không phù hợp diện tích/nắng, ngoài
      budget) → sau đó chấm điểm (soft scoring) theo usage_priority
      khách đã nêu (từ bước 2), trọng số riêng từng ngành hàng —
      19 category Nhóm 1 có rule chi tiết, ~97 category Nhóm 2 dùng
      rule chung (rerank + rating + quantity_sold) — chi tiết đầy
      đủ xem Flow_slot_filling.md mục 2
      → Top 3 sau lọc + chấm điểm, kèm lý do loại 2 sản phẩm sát top
      ↓
5. Enrich dữ liệu real-time (Flow_MCP.md — Luồng A)
      Orchestrator tự gọi asyncio.gather() cho product_id còn lại ×
      4 tool (price/stock/promo/review) CÙNG LÚC, timeout 1.5s/request
      → check cache TTL 60s trước, cache hit thì bỏ qua
      → lỗi/timeout → đánh dấu missing_data, không chặn sản phẩm khác
      ↓
6. Sinh câu trả lời — DeepSeek-V4-Flash (MVP, chưa routing
   gpt-oss-120b)
      Gộp: top 3 sau domain rule + policy liên quan + dữ liệu
      real-time đã enrich
      → SOURCE PRIORITY: Real-time API (giá/tồn kho/KM/review) >
        Policy/FAQ > Catalog RAG > Domain rule > suy luận LLM
      → Output structured: mỗi claim gắn {product_id, field_name,
        source_type ∈ [catalog, realtime, policy]}
      → Kèm scores{} (overall_rank, hard_filter_passed, criteria[])
        lấy thẳng từ Domain Rule Engine bước 4 + comparison_table
        cấp response khi ≥2 sản phẩm (API_contract.md mục 1.1)
      → Khi ≥2 sản phẩm: viết theo phong cách "chuyên gia bán hàng"
        — so sánh CHÉO giữa các sản phẩm (không mô tả rời từng cái),
        dịch thông số thành lợi ích thực tế, so sánh phân cực theo
        ưu tiên khách nêu, kết bằng câu hỏi CTA (chi tiết Flow_RAG.md)
      ↓
7. Guardrail check — rule-based, KHÔNG gọi lại LLM (Flow_RAG.md)
      Đối chiếu từng claim theo đúng source_type:
      realtime → dữ liệu Luồng A | catalog → chunk đã retrieve ở
      bước 3 | policy → chunk policy đã retrieve
      ├── Khớp → giữ, gắn source citation
      └── Không khớp/missing_data → thay bằng câu chuẩn theo
          field_name (VD "Hiện chưa có dữ liệu giá.")
      ↓
8. Ghi log — qua mask_pii() trước khi ghi
      Audit log: route (tool_calling|keyword) + input/output đã mask
      (số điện thoại, email che một phần — không ghi raw)
      ↓
9. Cập nhật customer_memory (DB)
      Ghi lại: slots_collected (bao gồm usage_priority, device_type
      nếu có), products_discussed (kèm giá lúc tư vấn — dùng cho
      bước Alert bên dưới), conversation_summary → KHÔNG ghi full
      transcript thô
      ↓
Trả lời khách: top 3 sản phẩm + trade-off + nguồn dữ liệu
      (mỗi claim có nút nhỏ → hover → popup source citation)


── Song song, chạy nền độc lập (không nằm trên đường phản hồi chính) ──

Flow_scheduler_alert_WebSocket.md — 2 lớp phát hiện thay đổi:
      LỚP 1 (event-driven, chính) → thay đổi giá/tồn kho trong hệ
      thống nội bộ trigger check_alert() ngay lập tức, gần tức thời
      LỚP 2 (polling 60s, dự phòng) → bắt thay đổi từ Product API
      thật không có event báo trước
      ↓
Alert Service quét products_discussed của mọi customer_memory →
phát hiện PRICE_DROP / BACK_IN_STOCK → dedup theo
{customer_id}:{product_id}:{alert_type} → WebSocket Server push
tới đúng customer_id đang online
→ (Demo: gọi POST /demo/trigger-alert qua curl/Postman ở máy bạn,
KHÔNG qua Swagger UI — /docs đã tắt trên server — để giám khảo
thấy real-time ngay lập tức mà không cần chờ điều kiện thật xảy ra)