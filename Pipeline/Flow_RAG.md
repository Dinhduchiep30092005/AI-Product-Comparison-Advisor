# Mục đích: Tìm sản phẩm phù hợp, lọc/chấm điểm theo domain rule, sinh câu trả lời có nguồn, chặn bịa dữ liệu

## Luồng hoạt động: Vector search catalog+policy → rerank → domain rule lọc/chấm điểm → enrich real-time (gọi sang Flow_MCP) → LLM sinh câu trả lời → guardrail đối chiếu từng claim

### Input: Slot đã đủ (từ Flow_slot_filling)
### Output: Top 3 sản phẩm + trade-off + nguồn dữ liệu cho từng claim

### Query construction (trước khi vào Vietnamese_Embedding):

      - KHÔNG dùng thẳng câu khách gốc, cũng KHÔNG dùng thẳng JSON slot đã extract — viết lại thành 1 câu query tự nhiên đầy đủ ngữ cảnh, gộp cả slot cứng (budget, room_size...) VÀ giữ nguyên các cụm mô tả định tính (pin trâu, chụp đẹp, chạy êm...)
      - KHÔNG rút gọn về từ khóa kỹ thuật thuần túy

      VD: slot đã extract = {category: máy tính bảng, budget: 8000000, usage_priority: [battery]}
      → Query để encode: "máy tính bảng pin trâu, ngân sách khoảng 8 triệu"
        (KHÔNG viết thành "máy tính bảng battery_priority=high budget=8000000" — mất hết ngữ nghĩa tự nhiên mà Vietnamese_Embedding cần để match)
      ↓
      → Encode bằng Vietnamese_Embedding, match tự nhiên với mô tả catalog có cụm gần nghĩa ("pin khủng 8000mAh", "dùng cả ngày không lo hết pin"...) — không cần dictionary ánh xạ thủ công

      → Category do LLM extract KHÔNG đi thẳng vào metadata filter: map bằng slug chuẩn hoá
        qua lookup category_label thật trong SQLite; giá trị ngoài taxonomy bị từ chối

      → Metadata pre-filter theo category_slug/price/device_type
        → Có candidate nhưng cosine similarity < CATALOG_MIN_SIMILARITY (mặc định 0.35 —
          hiệu chỉnh thực nghiệm trên AITeamVN/Vietnamese_Embedding: match đúng chủ đề
          thường ra cosine ~0.38-0.5, lạc đề ~0.25 trở xuống, KHÔNG phải 0.75 như giả định
          ban đầu — 0.75 từng khiến retrieval trả 0 candidate mọi lúc): loại
        → 0 candidate: nới price, sau đó retry vector thuần không metadata filter
        → Kết quả retry phải đối chiếu category source-of-truth trong SQLite trước khi dùng,
          tuyệt đối không trả sản phẩm khác danh mục

      → Log trực tiếp: category LLM sau canonicalization, category_slug query,
        category/category_label mẫu đang lưu trong Chroma, trạng thái category đã được
        đồng bộ lên vector index hay chưa, route retry và số candidate

### Lưu ý: Khi chunk catalog: nếu mô tả gốc chỉ có số liệu khô (VD "Dung lượng pin: 8000mAh") mà thiếu câu mô tả tự nhiên, nên PARAPHRASE THÊM 1 câu diễn giải khi tạo chunk (VD ghép thêm "pin dung lượng lớn, dùng được cả ngày" cạnh con số) — tăng điểm neo ngữ nghĩa để embedding match tốt hơn với cách khách nói chuyện đời thường. Việc này làm 1 lần lúc ingestion, không ảnh hưởng tốc độ query.

Product Catalog        Policy & FAQ           Real-time API (MCP)
(CSV/JSON - public)    (Markdown/JSON)        (Price/Stock/Promo/Review)
      ↓                      ↓                        ↓
Vector Store A          Vector Store B          Không qua vector store
(catalog_collection)   (policy_collection)      Gọi trực tiếp lúc query
      ↓                      ↓                        ↓
Rerank (bge-reranker-v2-m3)  ↓                        ↓
      ↓                      ↓                        ↓
Top 5 candidate          Chính sách liên quan     Luồng A parallel enrich
(catalog + spec đầy đủ                             (xem chi tiết Flow_MCP.md —
 giữ nguyên để guardrail                            asyncio.gather(), <2s)
 đối chiếu thông số sau)
      ↓
Domain Rule Engine (lọc + chấm điểm — KHÔNG để LLM tự chọn cảm tính)
      │
      ├── Bước lọc cứng (hard filter) — loại thẳng, không đưa vào top 3
      │
      └── Bước chấm điểm (soft scoring) trên phần còn lại — mỗi ngành hàng có trọng số riêng theo priority khách đã nêu
            
            → điểm số này là RULE tường minh (code, có công thức cụ thể theo từng field catalog), KHÔNG phải LLM tự ước lượng
              

      Chi tiết hard filter + scoring theo từng category (19 category Nhóm 1 đầy đủ, bao gồm ngưỡng số liệu cụ thể) → xem Flow_slot_filling.md mục 2. Nguyên tắc chung áp dụng cho MỌI category:
      
        - Giá ngoài budget khách cho → loại (trừ khi <2 sản phẩm còn lại thì nới dần, ghi rõ "hơi vượt ngân sách")
          
        - Field cần cho hard filter mà sản phẩm thiếu dữ liệu → KHÔNG loại (pass mặc định), tránh loại oan vì thiếu data — khác với việc báo "chưa có dữ liệu" ở bước guardrail sau
         
      ↓
Top 3 sau lọc + chấm điểm (kèm lý do bị loại của 2 sản phẩm sát top, để LLM có thể giải thích "vì sao không chọn X" nếu khách hỏi)
                                    ↓
                    scores{} cho từng sản phẩm (overall_rank, hard_filter_passed, criteria[]
                    {label, value_display, rating 1-5}) — lấy THẲNG từ dữ liệu Domain Rule Engine
                    vừa chấm điểm ở trên, KHÔNG tính lại/KHÔNG qua LLM. Tiêu chí nào sản phẩm
                    thiếu spec thì bỏ qua (không bịa rating) → gộp comparison_table.criteria_labels
                    ở cấp response khi có ≥2 sản phẩm (API_contract.md mục 1.1)
                                    ↓
                    Gộp lại → DeepSeek-V4-Flash (structured output: mỗi claim gắn kèm {product_id, field_name, source_type}) source_type ∈ {catalog, realtime, policy}
                    → Khi ≥2 sản phẩm: system prompt bắt buộc viết PHONG CÁCH SO SÁNH CHÉO
                      (mỗi câu nhắc ≥2 sản phẩm, chỉ rõ ai hơn ai ở điểm gì — KHÔNG mô tả từng
                      sản phẩm như đoạn văn rời nhau) + 4 nguyên tắc bán hàng (khách quan/thừa
                      nhận hạn chế có căn cứ, dịch thông số thành lợi ích, so sánh phân cực theo
                      ưu tiên khách nêu, luôn kết bằng câu hỏi CTA gợi mở bước tiếp theo)
                    
                          Guardrail check (rule-based, KHÔNG gọi lại LLM)
                          │
                          ├── source_type=realtime (giá/tồn kho/KM/review)
                          │     → đối chiếu claim với dữ liệu Luồng A đã enrich (in-memory)
                          │       
                          │
                          ├── source_type=catalog (thông số kỹ thuật: công suất, dung tích, camera, RAM...) → đối chiếu claim với chunk catalog đã retrieve ở top-5 (in-memory, không query lại ChromaDB)
                          │     
                          │       
                          │
                          ├── source_type=policy (bảo hành/trả góp...)  → đối chiếu với chunk policy đã retrieve
                          │    
                          │
                          ├── Khớp → giữ nguyên, gắn source citation
                          │
                          └── Không khớp / field bị missing_data → thay bằng câu chuẩn theo field_name (bảng bên dưới), TRƯỚC khi trả về khách
                                  
                                    ↓
                          Trả lời khách (<100ms cho bước guardrail)
