# Mục đích: Trích thông tin nhu cầu từ câu hỏi khách, quyết định hỏi thêm hay đủ để tư vấn

## Luồng tóm tắt: Extract slot (JSON) → so với schema critical theo category → thiếu thì gộp hỏi 1 lượt (tối đa 2 vòng) → đủ thì thoát sang RAG

### Input: Câu hỏi khách (tiếng Việt) + session slot state hiện có
### Output: Slot state đã đủ (hoặc đã gán is_assumed) + câu hỏi làm rõ (nếu còn thiếu)

Câu hỏi khách (lượt đầu hoặc lượt tiếp theo) + Session slot state hiện có
      ↓
1. Structured extraction — DeepSeek-V4-Flash trích slot từ câu hỏi,
   output JSON bắt buộc theo schema cố định (KHÔNG suy diễn tự do):
      {category, budget, room_size, sun_exposure, noise_priority,
       household_size, usage_purpose, device_type, payment_interest, ...}
   → Merge vào Session slot state (giá trị mới ghi đè giá trị cũ nếu
     khách sửa lại, VD "thôi 25 triệu cũng được")

1b. Slang/informal term mapping (mở rộng Lớp 1 — DeepSeek-V4-Flash
    tự hiểu, KHÔNG dùng dictionary tra cứu cứng):

    System prompt được bổ sung hướng dẫn nhận diện các cụm mô tả
    nhu cầu bằng ngôn ngữ đời thường, map vào đúng field
    usage_priority (mảng, có thể nhiều giá trị) theo category:

    category=điện thoại → usage_priority ∈ {battery, camera,
        performance/gaming, design/thin_light, storage}
        VD: "pin trâu" / "xài cả ngày không lo" → battery
            "chụp đẹp" / "sống ảo" → camera
            "chiến game mượt" / "chơi liên quân không giật" → performance
            "mỏng nhẹ" / "cầm gọn" → design

    category=laptop → usage_priority ∈ {performance, battery,
        portability, display, storage}
        VD: "cấu hình khủng" → performance
            "pin trâu" → battery
            "mỏng nhẹ dễ mang đi học" → portability

    category=máy lạnh → đã có noise_priority/sun_exposure ở slot
        gốc, thêm nhận diện: "chạy êm" → noise_priority=quiet,
        "làm lạnh nhanh" → cooling_speed=fast

    category=tủ lạnh → usage_priority ∈ {capacity, energy_saving,
        freezer_space}
        VD: "trữ đồ nhiều" → capacity, "tiết kiệm điện" → energy_saving

    → LLM tự suy luận cụm từ mới chưa liệt kê dựa trên ngữ nghĩa gần
      nhất với category đang xử lý, kể cả các category chưa có ví dụ
      mẫu ở trên (tivi, quạt, nồi cơm điện...) — không cứng nhắc yêu
      cầu đúng từ khóa mẫu ("pin khủng", "pin bền" cũng map vào
      battery như "pin trâu")
    → Merge usage_priority vào Session slot state cùng lúc với các
      slot khác ở bước 1 (cùng 1 lệnh gọi LLM, không tốn thêm round)
      ↓
   (tiếp tục bước 1c)

1c. Payment/promotion interest detection (áp dụng CHUNG cho MỌI
    category, không cần viết riêng theo từng ngành hàng như
    usage_priority):

    Nhận diện các cụm câu hỏi/quan tâm về trả góp hoặc khuyến mãi,
    set payment_interest=true:
      VD: "trả góp được không" / "có trả góp không" / "mua trả góp"
          "có khuyến mãi gì không" / "có KM không" / "giảm giá không"
          "có ưu đãi gì không" / "đang có chương trình gì không"

    → payment_interest là slot OPTIONAL, KHÔNG bắt buộc phải hỏi
      ép khách trả lời — chỉ set true nếu khách CHỦ ĐỘNG nhắc tới;
      nếu khách không đề cập gì, để null (KHÔNG suy đoán là false,
      để null nghĩa là "chưa biết", false nghĩa là "khách nói không
      quan tâm" — 2 trạng thái khác nhau)
    → Merge cùng lúc với các slot khác ở bước 1 (không tốn thêm round)
      ↓
   (tiếp tục bước 2 — Load slot schema như cũ)
      ↓
2. Load slot schema theo category (mapping cố định, không do LLM quyết):

   Toàn bộ tên field bên dưới đã verify khớp với products_detail.json
   (nguồn canonical) — KHÔNG dùng tên field của Spec_cate_gia.xlsx nữa.

   ═══════════════ NHÓM 1 — 19 category, rule viết tay ═══════════════
   (tổng 19 category liệt kê dưới đây: máy lạnh, tủ lạnh, máy giặt, máy
   sấy quần áo, máy rửa chén, tủ đông/tủ mát, máy nước nóng, micro,
   đồng hồ thông minh, máy tính bảng, laptop, điện thoại, tivi, loa/tai
   nghe, máy hút bụi, nồi cơm điện, quạt, đồng hồ thời trang, pc/máy in)

            category=máy lạnh
            Room size resolution (thứ tự ưu tiên):
            1. Dùng "Phạm vi làm lạnh hiệu quả" (parse range string,
               VD "Từ 30-40m2") — nguồn chính
            2. Nếu null → fallback quy đổi BTU→m² từ "Công suất làm
               lạnh" bằng công thức chuẩn ngành (BTU/600 ≈ m²) —
               chỉ cứu thêm được số ít sản phẩm
            3. Cả 2 đều null → không loại (pass hard filter, để trống)
            Hard filter: loại nếu giá ngoài budget (trừ khi <2 sp còn
              lại); loại nếu room_size khách nêu KHÔNG rơi vào khoảng
              đã resolve ở trên
            Scoring: nhãn năng lượng cao hơn nếu ưu tiên tiết kiệm
              điện; "Độ ồn trung bình" thấp hơn nếu noise_priority=quiet

            category=tủ lạnh
            Hard filter: loại nếu giá ngoài budget; loại nếu "Dung
              tích sử dụng" dưới ngưỡng theo household_size (1-2
              người →150-250L, 3-4 người →250-350L, ≥5 người →>350L)
            Scoring: "Công suất tiêu thụ công bố theo TCVN" thấp hơn
              nếu usage_purpose=energy_saving

            category=máy giặt
            Hard filter: loại nếu giá ngoài budget; loại nếu "Khối
              lượng giặt" dưới ngưỡng theo household_size (1-2 người
              →7-8kg, 3-4 người →9-10kg, ≥5 người →>10kg) — có thể
              dùng trực tiếp field "Số người sử dụng" nếu sản phẩm có,
              ưu tiên field này hơn suy luận từ khối lượng
            Scoring: khớp "Loại máy giặt" (cửa trên/cửa ngang) với
              door_type_preference nếu có nêu; "Tốc độ quay vắt tối
              đa" cao hơn nếu ưu tiên khô nhanh

            category=máy sấy quần áo
            Hard filter: loại nếu giá ngoài budget; loại nếu "Khối
              lượng sấy" dưới ngưỡng theo household_size (tương tự
              máy giặt) — hoặc dùng trực tiếp "Số người sử dụng" nếu có
            Scoring: "Công nghệ" ưu tiên bơm nhiệt (tiết kiệm điện
              hơn) nếu usage_purpose=energy_saving

            category=máy rửa chén
            Hard filter: loại nếu giá ngoài budget; loại nếu "Khay
              chén" (số bộ) không đủ theo household_size (ước lượng
              1 bộ chén/người, làm tròn lên)
            Scoring: "Độ ồn" thấp hơn nếu noise_priority=quiet

            category=tủ đông, tủ mát
            Hard filter: loại nếu giá ngoài budget; loại nếu "Dung
              tích tổng" không khớp usage_purpose (gia đình → dưới
              200L ưu tiên, kinh doanh → ưu tiên >200L)
            Scoring: "Điện năng tiêu thụ" thấp hơn nếu ưu tiên tiết
              kiệm điện

            category=máy nước nóng
            Hard filter: loại nếu giá ngoài budget; loại nếu "Loại
              máy" không khớp heater_type_preference khi khách chỉ
              định rõ (trực tiếp/gián tiếp/năng lượng mặt trời)
            Scoring: "Thời gian đun nóng có thể sử dụng được" và
              "Công suất làm nóng" cao hơn được ưu tiên nếu
              household_size lớn; "Dung tích bình chứa" lớn hơn nếu
              household_size lớn

            category=micro (gộp chung karaoke + thu âm điện thoại —
              products_detail.json KHÔNG tách 2 category này riêng
              như Spec_cate_gia; volume nhỏ, 36 sản phẩm)
            Slot: critical: [budget], optional: [usage_purpose]
              (karaoke/thu âm-livestream)
            Hard filter: loại nếu giá ngoài budget
            Scoring: nếu usage_purpose=karaoke → ưu tiên có "Tần số
              hoạt động"/"Băng tần" (đặc trưng micro karaoke); nếu
              usage_purpose=thu âm/livestream → ưu tiên "Khoảng cách
              truyền" xa hơn, "Thời lượng pin" cao hơn (đặc trưng
              micro thu âm không dây gắn điện thoại)

            category=đồng hồ thông minh
            Hard filter: loại nếu giá ngoài budget; loại nếu
              usage_priority chứa "health_tracking" mà "Tiện ích
              khác" không chứa từ khóa liên quan sức khỏe/thể thao
              (field "Theo dõi sức khoẻ" riêng KHÔNG tồn tại trong
              products_detail.json — dùng "Tiện ích khác" làm proxy,
              tìm keyword thay vì field chuyên biệt)
            Scoring: "Thời gian sử dụng pin" cao hơn nếu
              battery_priority

            category=máy tính bảng
            Hard filter: loại nếu giá ngoài budget
            Scoring: "RAM", "Dung lượng pin" cao hơn theo
              usage_priority tương ứng (học tập/giải trí/vẽ)

            category=laptop
            Slot: critical: [budget, usage_purpose] (văn phòng/
              gaming/đồ họa/lập trình), optional: [portability_priority]
            Hard filter: loại nếu giá ngoài budget
            Scoring: "Tốc độ CPU", "Số nhân", "RAM", "Card màn hình"
              cao hơn nếu usage_purpose=gaming/đồ họa; "Kích thước
              màn hình"/khối lượng nhỏ hơn nếu portability_priority

            category=điện thoại
            Slot: critical: [budget, usage_priority] (camera/pin/game), optional: [brand_preference]
            Hard filter: loại nếu giá ngoài budget
            Scoring theo usage_priority khách nêu:
                - battery → "Dung lượng pin" cao hơn
                - camera → "Độ phân giải camera sau" cao hơn
                - performance/gaming → "Tốc độ CPU" cao hơn, ưu tiên "Chip xử lý
                (CPU)" đời mới/cao cấp
                - storage → "Dung lượng lưu trữ" cao hơn
                - design/thin_light → "Kích thước, khối lượng" nhẹ hơn

            category=tivi
            Slot: critical: [budget, usage_purpose] (giải trí gia
              đình/gaming/phòng ngủ), optional: [screen_size_priority]
            Hard filter: loại nếu giá ngoài budget
            Scoring: "Tần số quét thực" cao hơn nếu usage_purpose=
              gaming; "Độ phân giải" cao hơn nếu ưu tiên hình ảnh nét;
              "Kích cỡ màn hình" khớp screen_size_priority nếu có

            category=loa, tai nghe
            Lưu ý dữ liệu: category này gộp CHUNG loa và tai nghe —
              field phủ không đều vì nhiều field chỉ có nghĩa với 1
              trong 2 loại. Cần slot phụ device_type ∈ {loa, tai_nghe}
              TRƯỚC khi áp hard filter/scoring
            Slot: critical: [budget, device_type], optional:
              [usage_purpose] (nghe nhạc/gaming/gọi điện),
              [battery_priority]
            Hard filter: loại nếu giá ngoài budget; loại nếu
              device_type không khớp (suy ra từ tên sản phẩm)
            Scoring: "Thời lượng pin" cao hơn nếu battery_priority
              (chỉ áp dụng khi device_type=tai_nghe); ưu tiên kết nối
              không dây nếu usage_purpose có nhắc "không dây"

            category=máy hút bụi
            Slot: critical: [budget], optional: [household_size,
              noise_priority]
            Hard filter: loại nếu giá ngoài budget
            Scoring: "Công suất hút" cao hơn nếu ưu tiên hút sạch;
              "Độ ồn cao nhất" thấp hơn nếu noise_priority=quiet;
              "Dung tích" lớn hơn nếu household_size lớn

            category=nồi cơm điện
            Slot: critical: [household_size, budget], optional:
              [usage_purpose] (nấu thường/nấu cháo-hầm)
            Hard filter: loại nếu giá ngoài budget; loại nếu "Dung
              tích" dưới ngưỡng theo household_size (1-2 người
              →1-1.5L, 3-4 người →1.5-2L, ≥5 người →>2L)
            Scoring: "Công nghệ nấu" cao cấp hơn (áp suất/tách đường)
              được ưu tiên nếu usage_purpose liên quan nấu kỹ/đa năng

            category=quạt các loại
            Slot: critical: [budget], optional: [usage_purpose]
              (làm mát nhanh/phòng lớn/mang đi)
            Hard filter: loại nếu giá ngoài budget
            Scoring: "Công suất" cao hơn nếu ưu tiên làm mát phòng
              lớn/nhanh

            category=đồng hồ thời trang
            Slot: critical: [budget], optional: [usage_purpose]
              (thời trang/thể thao/quà tặng), [brand_preference]
            Hard filter: loại nếu giá ngoài budget
            Scoring: dùng rerank score + rating + quantity_sold
              (category này thiên về thẩm mỹ/thương hiệu hơn thông
              số kỹ thuật, không có field kỹ thuật sâu để chấm điểm
              khác biệt — dù volume lớn nhất catalog (3.138sp), bản
              chất vẫn giống Nhóm 2 hơn về mặt chấm điểm)

            category=pc, máy in (GỘP 5 loại sản phẩm khác nhau trong
              products_detail.json: PC để bàn, màn hình, máy in thật,
              phụ kiện mực in, máy quét mã vạch — bắt buộc phải tách
              sub-type trước khi áp rule, xem chi tiết dưới)

            ── Bước tách device_type (thực hiện lúc ingestion, gắn
               vào metadata mỗi sản phẩm, KHÔNG chờ tới lúc query) ──
              Suy ra device_type từ field có mặt trong specs:
                - Có field "Chip xử lý (CPU)"/"CPU" → device_type=
                  pc_de_ban
                - Có field "Tốc độ in" → device_type=may_in
                - Có field "Kích thước màn hình" + "Tần số quét"
                  NHƯNG KHÔNG có CPU → device_type=man_hinh
                - Tên sản phẩm chứa "mực"/"hộp mực" → device_type=
                  phu_kien_muc_in
                - Tên sản phẩm chứa "quét mã vạch" → device_type=
                  may_quet
                - Không khớp trường hợp nào → device_type=khac
                  (fallback, dùng rule Nhóm 2)

            Slot: critical: [budget, device_type] (LLM hỏi khách
              "bạn cần PC để bàn, màn hình, hay máy in?" nếu câu hỏi
              chưa rõ loại nào), optional: [usage_purpose]

            Hard filter: loại nếu giá ngoài budget; loại nếu
              device_type sản phẩm không khớp device_type khách cần

            Scoring theo device_type (chỉ áp dụng khi đã lọc đúng
              device_type):
              - pc_de_ban: "Tốc độ CPU", "Số nhân", RAM cao hơn nếu
                usage_purpose=gaming/đồ họa; ưu tiên nhẹ hơn phần
                cứng mạnh nếu usage_purpose=văn phòng nhẹ
              - man_hinh: "Thời gian đáp ứng" thấp hơn nếu
                usage_purpose=gaming; "Độ phân giải" cao hơn nếu
                usage_purpose=đồ họa; "Kích thước màn hình" theo
                screen_size_priority nếu có
              - may_in: "Chất lượng in (độ nét)" cao hơn nếu
                usage_purpose=in ảnh; "Tốc độ in" cao hơn nếu
                usage_purpose=in số lượng lớn
              - phu_kien_muc_in, may_quet: KHÔNG viết rule riêng —
                dùng rule Nhóm 2 (rerank + rating + quantity_sold),
                vì đây là phụ kiện/thiết bị chuyên dụng ít khi cần
                so sánh sâu theo nhu cầu

   ═══════════════ NHÓM 2 — ~97 category phụ/nhỏ còn lại ═══════════════
   (VD: dây đồng hồ, túi đựng phụ kiện, hub cáp kết nối, ốp lưng,
   balo, sạc/cáp, phụ kiện điện thoại khác, phụ kiện mực in/máy
   quét từ category Pc-máy in ở trên...)

            category=NHÓM 2 (mặc định — áp dụng khi category không
              khớp bất kỳ category nào ở Nhóm 1)
            Slot: critical: [budget], optional: [usage_purpose]
              (dùng để refine query construction ở bước embedding,
              KHÔNG dùng để hard filter)
            Hard filter: CHỈ 1 điều kiện — loại nếu giá ngoài budget
              (trừ khi <2 sản phẩm còn lại thì nới dần)
            Scoring: dùng 3 tín hiệu phổ quát có sẵn ở MỌI sản phẩm
              (từ schema chuẩn hóa data_normalization.md):
                1. Điểm rerank (bge-reranker-v2-m3) — trọng số cao nhất
                2. "rating" — ưu tiên nhẹ (tie-breaker)
                3. "quantity_sold" — ưu tiên nhẹ
              KHÔNG bịa thêm tiêu chí kỹ thuật đặc thù nào khác
            Trade-off giải thích cho khách: tập trung vào rating/
              lượt bán/giá thay vì bịa khác biệt kỹ thuật không có
              trong data

   Áp dụng payment_interest cho MỌI category (Nhóm 1 lẫn Nhóm 2):
     - payment_interest KHÔNG nằm trong danh sách critical của bất
       kỳ category nào → KHÔNG được dùng để kích hoạt vòng lặp hỏi
       lại ở bước 3 (không chặn tiến trình chỉ vì thiếu slot này)
     - Nếu payment_interest=true → khi sinh câu trả lời cuối cùng
       (Flow_RAG.md, bước gộp → DeepSeek-V4-Flash), LLM thêm 1 đoạn
       ngắn về chính sách trả góp/khuyến mãi cho sản phẩm đề xuất.
       Nguồn ưu tiên: get_product_promotion (Luồng A, đã enrich sẵn,
       dữ liệu cụ thể theo sản phẩm) trước, ghép thêm search_policy
       nếu cần chi tiết kỳ hạn/điều kiện trả góp chung (nguồn:
       policy_type=bảo_hành_đổi_trả hoặc metadata liên quan trả góp
       trong 7 file chính sách đã ingest) — gộp cả 2 khi cả hai đều có
       dữ liệu, không phải chọn 1 trong 2 (khớp `payment_note` ở
       API_contract.md mục 1.1) — vẫn qua guardrail như mọi claim khác,
       KHÔNG được bịa nếu không có dữ liệu trả góp cho sản phẩm đó
     - Nếu null hoặc false → KHÔNG chủ động nhắc trả góp/KM trong
       câu trả lời (tránh tạo cảm giác ép mua, đúng yêu cầu Request.md)

   → Nếu category chưa xác định được → category tự nó là critical
     duy nhất, hỏi trước tiên
      ↓
3. Diff: so Session slot state với danh sách critical của category
      │
      ├── Thiếu ≥1 slot critical
      │         ↓
      │    Gộp TẤT CẢ câu hỏi còn thiếu vào 1 lượt hỏi duy nhất
      │    (không hỏi từng cái một → tránh hỏi vặt nhiều lượt)
      │    VD: "Anh/chị dùng phòng khoảng bao nhiêu m² và
      │         ngân sách tầm bao nhiêu ạ?"
      │         ↓
      │    Tăng clarify_round += 1
      │         ↓
      │    clarify_round > MAX_CLARIFY_ROUNDS (=2)?
      │         ├── Chưa vượt → gửi câu hỏi, dừng vòng lặp,
      │         │               chờ khách trả lời → quay lại bước 1
      │         └── Đã vượt → KHÔNG hỏi thêm nữa, dùng giá trị mặc định
      │                       an toàn cho slot còn thiếu (VD room_size
      │                       mặc định "phòng ngủ tiêu chuẩn ~15m²"),
      │                       đánh dấu is_assumed=true cho slot đó
      │                       → đi tiếp bước 4, LLM phải nói rõ trong
      │                         câu trả lời cuối là đang giả định
      │                         (minh bạch, không bịa là khách đã nói)
      │
      └── Đủ slot critical (hoặc đã dùng hết lượt hỏi)
                ↓
           Thoát vòng lặp slot-filling → sang bước Truy xuất & rerank
           (flow RAG đã viết trước đó)