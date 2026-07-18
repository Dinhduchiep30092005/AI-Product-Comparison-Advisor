# Mục đích: Toàn bộ vòng lặp xử lý 1 lượt chat: từ nhận input tiếng Việt đến trả lời có nguồn

## Luồng hoạt động: Xử lý tiếng Việt 3 lớp → tool-calling loop (hoặc fallback keyword) → gọi tool → tổng hợp theo source priority → trả lời có citation

### Input: Câu hỏi khách + session

### Output: Câu trả lời cuối cùng (đã tổng hợp, có nguồn)


Khách gõ tiếng Việt (có thể không có dấu)
      ↓
0. Bắt đầu lượt mới:
      → Reset recent_tool_results, citation list và policy chunks của lượt trước
      → Chỉ giữ conversation memory bền vững (slot, summary, last_top)
      → Citation chỉ được tạo lại từ tool result thực sự dùng trong lượt hiện tại; dedupe theo tài liệu/tool
      ↓
1. Nhận input + Xử lý tiếng Việt (3 lớp):
      │
      ├── Lớp 1: System prompt
      │         DeepSeek-V4-Flash tự hiểu không dấu + viết tắt + đơn vị đo (HP, BTU, m², inch, lít, GB...) → Xử lý được → đi tiếp
      │         
      │         
      │
      ├── Lớp 2: RAG từ Policy & FAQ
      │         Thuật ngữ/câu hỏi chính sách cụ thể → Tra Vector Store B (policy_collection)
      │         → cosine similarity >= POLICY_MIN_SIMILARITY (mặc định 0.35 — hiệu chỉnh
      │           thực nghiệm: match đúng chính sách thường ra cosine ~0.39-0.47, câu hỏi
      │           mơ hồ/lạc đề ~0.25 trở xuống; 0.75 từng loại luôn cả kết quả đúng): dùng
      │           kết quả + citation
      │         → score thấp: bỏ kết quả, không gắn citation, chuyển Lớp 3
      │         
      │         
      │
      └── Lớp 3: LLM tự suy luận từ context
                Không có kết quả policy đủ liên quan → tự suy luận từ ngữ cảnh hội thoại
                → Vẫn không hiểu/câu quá mơ hồ: hỏi khách đang hỏi sản phẩm hay chính sách nào;
                  KHÔNG mặc định route vào search_policy
                
                
      ↓
2. PRIMARY PATH — LLM tool-calling loop:

      Bước so sánh top-5 sau rerank (bắt buộc mọi lượt) KHÔNG đi qua loop này — dùng Luồng A deterministic parallel enrich (4 tool: price/stock/promotion/review, gọi song song theo product_id), xem chi tiết tại Flow_MCP.md. Loop dưới đây chỉ áp dụng cho câu hỏi tự do giữa chừng, ngoài top-5 (VD hỏi thêm 1 sản phẩm khác, hỏi trả góp riêng lẻ, hỏi chính sách rời).
      
      LLM nhận đủ 5 MCP tool specs (get_product_price, get_product_stock, get_product_promotion, get_product_review, search_policy) — không có cost_price (Orchestrator lọc trước khi đưa vào tool spec, LLM không được thấy)
      
      → LLM tự chọn tool + tham số, tối đa 3 vòng (TOOL_CALL_MAX_ROUNDS)
      → Toàn bộ 5 tool đều read-only → auto-exec, KHÔNG có tool side-effect (domain này không có action như soạn draft/gửi email cần khách xác nhận, nên không cần cơ chế Pending Action)
       
      → Mỗi tool call đi qua registry = MCP tool logic (validate product_id tồn tại trong catalog trước khi gọi API — riêng search_policy validate policy_type thay vì product_id)
        
      → Trước khi gọi registry: check session cache theo (product_id, tool) — TTL 60s (giá/tồn kho/review đổi liên tục, cache dài dễ trả dữ liệu cũ). Còn hạn → dùng lại, KHÔNG gọi lại API. Hết hạn/chưa có → gọi registry rồi cache lại.
 
      → Session chỉ prepend dữ liệu bền vững: slot đã thu thập (category, budget,
        room_size, priority...), conversation_summary và last_top khi cần follow-up.
        recent_tool_results/citations là turn-scoped và không được mang sang lượt sau.
        
   FALLBACK PATH — keyword routing, CHỈ kích hoạt khi tool calling thất bại về mặt kỹ thuật:
      - provider không hỗ trợ tool calling
      - TOOL_CALLING_ENABLED=false
      - timeout (TOOL_CALL_TIMEOUT_SECONDS)
      - lỗi provider (API down, throttle...)
      - output không hợp lệ → reject an toàn, tool không execute: tool lạ (LLM bịa tên), args sai schema, không có final answer, vượt 3 vòng
        
      → route intent bằng keyword (có dấu/không dấu) rồi gọi tool cố định
      ↓
3. Gọi tool qua MCP (Kiểm tra product_id tồn tại / Không có dữ liệu → nói "chưa có dữ liệu" / Không tự bịa giá trị)
   
      ↓
4. Tổng hợp (gộp toàn bộ kết quả tool + rerank catalog thành 1 câu trả lời)
      → Khi khách hỏi kiểu "nên chọn cái nào" ("nên mua cái nào", "cái nào tốt hơn"): system prompt bắt LLM tổng hợp theo đúng SOURCE PRIORITY: Real-time API (giá/tồn kho/KM/review) > Policy/FAQ > Catalog RAG đã rerank > Domain rule (trade-off theo ngành hàng) > suy luận LLM — không được ưu tiên suy luận hơn dữ liệu thật
      → Phong cách trả lời: khách quan (thừa nhận hạn chế nếu dữ liệu cho thấy có căn cứ,
        không khen chung chung), dịch thông số thành lợi ích thực tế theo đúng câu hỏi khách,
        so sánh phân cực khi khách đang phân vân ≥2 sản phẩm, và LUÔN kết bằng 1 câu hỏi CTA
        gợi mở bước tiếp theo (trừ khi câu trả lời là hỏi lại khách để làm rõ ý)
      ↓
5. Trả lời có nguồn gốc
      Source metadata từ kết quả tool → Source Citation (mỗi sản phẩm đề xuất kèm nguồn: giá lấy lúc nào, tồn kho theo kho nào, thông số lấy từ catalog) → audit log ghi thêm route: tool_calling | keyword
      
      → Frontend render nút nhỏ cạnh mỗi claim → hover → popup nguồn
      ↓
Khách nhận câu trả lời (top 3 sản phẩm + trade-off + nguồn)
