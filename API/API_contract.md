

## Định nghĩa toàn bộ contract (request/response) giữa các thành phần: Frontend Khách hàng, Frontend Admin, Backend Orchestrator, MCP Server, và WebSocket Server. Đây là nguồn tham chiếu duy nhất — không định nghĩa lại field ở nơi khác.


## 0. QUY ƯỚC CHUNG

- Toàn bộ timestamp dùng chuẩn ISO 8601 (VD `"2026-07-18T09:30:00+07:00"`)
- `product_id` trong MỌI endpoint/tool = giá trị field `product_code` sau chuẩn hoá (xem `data_normalization.md`), KHÔNG phải field `product_id` gốc của `products_detail.json`
- Giá trị tiền: integer, đơn vị VNĐ, không có dấu phân cách (VD `18500000`, không phải `"18.500.000đ"`)
- Mọi response lỗi dùng chung format:
```json
{
  "error": true,
  "code": "PRODUCT_NOT_FOUND | INVALID_PARAMS | RATE_LIMITED | INTERNAL_ERROR",
  "message": "Mô tả lỗi ngắn gọn bằng tiếng Việt"
}
```
- Field bị thiếu dữ liệu luôn trả về `null`, KHÔNG trả `""`, `"N/A"`, hay bỏ field khỏi response

---

## 1. CHAT API (Khách hàng ↔ Backend)

### 1.1 `POST /api/chat`

Endpoint chính — mọi lượt hội thoại đi qua đây (bao gồm slot-filling, so sánh sản phẩm, câu hỏi tự do).

**Request:**
```json
{
  "customer_id": "demo_001",
  "message": "Em muốn mua máy lạnh dưới 20 triệu cho phòng 18m², tiết kiệm điện, ít ồn"
}
```

**Response — trường hợp cần hỏi làm rõ (slot chưa đủ):**
```json
{
  "type": "CLARIFYING_QUESTION",
  "message": "Dạ, anh/chị dùng cho phòng ngủ hay phòng khách, và phòng có bị nắng trực tiếp không ạ?",
  "session": {
    "clarify_round": 1,
    "slots_collected": {
      "category": "máy lạnh",
      "budget": 20000000,
      "room_size": 18,
      "usage_priority": ["energy_saving", "quiet"]
    }
  }
}
```

**Response — trường hợp đã đủ slot, trả về so sánh sản phẩm:**
```json
{
  "type": "PRODUCT_COMPARISON",
  "message": "Dựa trên nhu cầu của anh/chị, đây là 3 lựa chọn phù hợp nhất:",
  "products": [
    {
      "product_id": "1751098000181",
      "product_name": "Máy lạnh Daikin Inverter 1.5HP FTKF35XVMV",
      "brand": "Daikin",
      "image_url": "https://...",
      "price": {
        "original_price": 12990000,
        "sale_price": 10990000,
        "currency": "VND",
        "source_type": "realtime",
        "fetched_at": "2026-07-18T09:29:55+07:00"
      },
      "stock": {
        "status": "in_stock",
        "stock_quantity": 12,
        "store_id": null,
        "source_type": "realtime",
        "fetched_at": "2026-07-18T09:29:56+07:00"
      },
      "promotion": {
        "value": "Tặng phiếu mua hàng 200.000đ",
        "source_type": "realtime",
        "fetched_at": "2026-07-18T09:29:56+07:00"
      },
      "review": {
        "rating": 4.7,
        "review_count": 128,
        "summary": "Khách hàng khen máy chạy êm, làm lạnh nhanh",
        "source_type": "realtime",
        "fetched_at": "2026-07-18T09:29:57+07:00"
      },
      "highlighted_specs": [
        {"field_name": "do_on_trung_binh", "label": "Độ ồn", "value": "16 dB", "source_type": "catalog"},
        {"field_name": "nhan_nang_luong", "label": "Nhãn năng lượng", "value": "5 sao", "source_type": "catalog"}
      ],
      "explanation": "Máy chạy êm nhất trong 3 lựa chọn (16dB), phù hợp phòng ngủ. Nhãn năng lượng 5 sao giúp tiết kiệm điện.",
      "is_assumed_fields": [],
      "payment_note": null,
      "scores": {
        "overall_rank": 1,
        "hard_filter_passed": true,
        "criteria": [
          {"label": "Độ ồn", "value_display": "16 dB", "rating": 5}
        ]
      }
    }
  ],
  "comparison_table": {
    "criteria_labels": ["Độ ồn", "Tiết kiệm điện"],
    "note": "Dựng lại từ scores{} của từng sản phẩm, không gọi thêm LLM"
  },
  "excluded_note": "2 sản phẩm khác không được chọn vì công suất chưa phù hợp với phòng có nắng trực tiếp",
  "session": {
    "clarify_round": 1,
    "slots_collected": { "...": "..." }
  }
}
```

**Ghi chú field quan trọng:**
- Mỗi field dữ liệu (`price`, `stock`, `promotion`, `review`, mỗi phần tử trong `highlighted_specs`) LUÔN kèm `source_type` (`catalog` | `realtime` | `policy`) và thời điểm lấy dữ liệu — dùng cho source citation ở frontend
- `scores`: lấy trực tiếp từ Domain Rule Engine (bước lọc + chấm điểm ở `Flow_RAG.md`) — KHÔNG tính lại, KHÔNG do LLM ước lượng. `overall_rank` là thứ tự hiển thị trong `products[]` (1 = đề xuất đầu tiên), không phải thứ hạng trong toàn bộ candidate. `criteria` chỉ liệt kê tiêu chí mà sản phẩm THỰC SỰ có dữ liệu spec tương ứng — category/sản phẩm nào rule engine không áp dụng tiêu chí đó (hoặc thiếu spec) thì bỏ qua phần tử đó, KHÔNG điền `rating` giả. `rating` thang 1-5 sao.
- `comparison_table`: ở cấp response (ngang hàng `products`), CHỈ có giá trị (khác `null`) khi `products` có từ 2 phần tử trở lên. `criteria_labels` là danh sách nhãn tiêu chí gộp từ `scores.criteria` của tất cả sản phẩm được hiển thị (không gồm "Giá" — frontend lấy giá trực tiếp từ `price.sale_price` của từng sản phẩm, không qua `scores`)
- `is_assumed_fields`: mảng tên slot bị gán giá trị mặc định (VD `["room_size"]`) khi khách không trả lời đủ 2 vòng hỏi — frontend hiển thị nhạt màu/ghi chú giả định
- `payment_note`: chỉ có giá trị khi `payment_interest=true` trong slot. Nguồn ưu tiên: `get_product_promotion` (dữ liệu cụ thể theo sản phẩm, đã enrich sẵn từ Luồng A) trước, ghép thêm `search_policy` nếu cần chi tiết kỳ hạn/điều kiện trả góp chung — gộp cả 2 khi cả hai đều có dữ liệu, không phải chọn 1 trong 2. `null` nếu không áp dụng
- Field nào thiếu dữ liệu thật (guardrail chặn) → value là chuỗi chuẩn cố định (VD `"Hiện chưa có dữ liệu giá."`), KHÔNG phải object rỗng

---

## 2. MCP TOOLS (Backend ↔ MCP Server)

Đây là tool spec nội bộ — LLM (Luồng B) hoặc Orchestrator (Luồng A) gọi qua MCP SDK, KHÔNG phải REST endpoint public.

### 2.1 `get_product_price`
```
Input:  { "product_id": "1751098000181" }
Output: {
  "product_id": "1751098000181",
  "price": 10990000,
  "original_price": 12990000,
  "currency": "VND",
  "timestamp": "2026-07-18T09:29:55+07:00"
}
Lỗi: { "product_id": "...", "price": null, "error": "MISSING_DATA" }
```

### 2.2 `get_product_stock`
```
Input:  { "product_id": "1751098000181", "store_id": null }
Output: {
  "product_id": "1751098000181",
  "stock_quantity": 12,
  "status": "in_stock",  // in_stock | out_of_stock
  "store_id": null,
  "timestamp": "2026-07-18T09:29:56+07:00"
}
```

### 2.3 `get_product_promotion`
```
Input:  { "product_id": "1751098000181" }
Output: {
  "product_id": "1751098000181",
  "promotion_text": "Tặng phiếu mua hàng 200.000đ",
  "discount_percent": null,
  "expiry": null,
  "timestamp": "2026-07-18T09:29:56+07:00"
}
Nếu không có KM riêng: { "product_id": "...", "promotion_text": null, "timestamp": "..." }
```

### 2.4 `get_product_review`
```
Input:  { "product_id": "1751098000181" }
Output: {
  "product_id": "1751098000181",
  "rating": 4.7,
  "review_count": 128,
  "summary": "Khách hàng khen máy chạy êm, làm lạnh nhanh",
  "timestamp": "2026-07-18T09:29:57+07:00"
}
```

### 2.5 `search_policy`
```
Input:  { "query": "chính sách trả góp máy lạnh", "policy_type": null }
        // policy_type optional, filter theo taxonomy cố định nếu có:
        // bảo_hành_đổi_trả | giao_hàng_lắp_đặt | bảo_mật_dữ_liệu |
        // điều_khoản_sử_dụng | chăm_sóc_khách_hàng | khác
Output: {
  "results": [
    {
      "chunk_text": "...",
      "policy_type": "bảo_hành_đổi_trả",
      "source_document": "chinh_sach_bao_hanh_doi_tra.md",
      "section_title": "1) Bảo hành có cam kết trong 12 tháng"
    }
  ]
}
```

**Tool spec cho LLM tool-calling (Luồng B)** — mirror 5 tool trên, KHÔNG expose `cost_price` trong bất kỳ output nào:
```
get_product_price      - Lấy giá hiện tại              - product_id
get_product_stock      - Kiểm tra tồn kho               - product_id, store_id
get_product_promotion  - Lấy khuyến mãi đang áp dụng     - product_id
get_product_review     - Lấy tóm tắt đánh giá            - product_id
search_policy          - Tra cứu chính sách              - query | policy_type
```

---

## 3. ADMIN API

### 3.0 Xác thực & Dashboard

**`POST /admin/login`** — `{ "username": "...", "password": "..." }` → `{ "success": true, "token": "..." }` (Bearer token, không hết hạn theo thời gian — chỉ mất khi `logout`)

**`POST /admin/logout`** — yêu cầu header `Authorization: Bearer <token>`

**`GET /admin/stats`** — `{ "total_products": 13754, "in_stock": ..., "out_of_stock": ..., "policy_documents": ..., "recent_products": [...] }` — `recent_products` là 5 sản phẩm có `updated_at` mới nhất (mới thêm hoặc vừa PATCH giá/tồn kho), mỗi phần tử cùng dạng với 1 item của `GET /admin/products` (mục 3.1) kèm thêm field `updated_at`; dùng cho bảng "Sản phẩm mới cập nhật" ở tab Tổng quan admin dashboard.

Toàn bộ endpoint `/admin/*` bên dưới (trừ `/admin/login`) yêu cầu header `Authorization: Bearer <token>`.

### 3.1 Quản lý sản phẩm

**`GET /admin/products/categories`** — `{ "categories": ["Máy lạnh", "Tủ lạnh", ...] }` (toàn bộ `category_label` distinct trong catalog)

**`GET /admin/products?search=&category=&page=`**
```json
{
  "total": 13754,
  "page": 1,
  "products": [
    { "product_id": "1751098000181", "product_name": "...", "category": "máy lạnh",
      "original_price": 12990000, "sale_price": 10990000, "stock_quantity": 12,
      "rating": 4.7, "image_url": "..." }
  ]
}
```

**`GET /admin/products/{product_id}`** — chi tiết đầy đủ 1 sản phẩm (toàn bộ field theo schema chuẩn hoá, xem mục 5)

**`PATCH /admin/products/{product_id}`**
```json
// Request — chỉ gửi field cần đổi
{
  "original_price": 12990000,
  "sale_price": 9990000,
  "stock_quantity": 8,
  "stock_status": "in_stock",
  "review": { "rating": 4.8, "review_count": 130, "summary": "..." }
}
// Response
{
  "success": true,
  "product_id": "1751098000181",
  "updated_at": "2026-07-18T10:00:00+07:00",
  "cache_invalidated": true
}
```
⚠ PATCH thành công PHẢI trigger 2 việc ngay lập tức: (1) invalidate cache MCP tool cho `product_id` này (TTL 60s bị huỷ sớm), (2) gọi `check_alert(product_id)` — Lớp 1 event-driven của `Flow_scheduler_alert_WebSocket.md`.

`stock_quantity` ghi qua PATCH này đi thẳng vào cùng kho dữ liệu mà `get_product_stock` đọc — không có 2 store cần đồng bộ, áp dụng cùng nguyên tắc "runtime ghi/đọc chung 1 nguồn" như giá.

### 3.2 Quản lý chính sách

**`GET /admin/policies`**
```json
{
  "policies": [
    { "id": "pol_001", "title": "Chính sách bảo hành đổi trả",
      "policy_type": "bảo_hành_đổi_trả", "status": "active",
      "uploaded_at": "2026-07-17T08:00:00+07:00", "chunk_count": 24 }
  ]
}
```

**`GET /admin/policies/check-replace?policy_type=...`** — kiểm tra trước khi upload xem `policy_type` đã có tài liệu `active` hay chưa
```json
{ "will_replace": true, "replaces_policy_id": "pol_001", "replaces_title": "Chính sách bảo hành đổi trả" }
```

**`POST /admin/policies/upload`** — bước 1: parse + chunk, CHƯA lưu
```json
// Request: multipart/form-data { file: <PDF/DOCX/TXT/MD> } hoặc { raw_text: "..." }
// Response
{
  "preview_id": "prev_9f8a",
  "chunks": [
    { "index": 0, "text": "1) BẢO HÀNH CÓ CAM KẾT TRONG 12 THÁNG ..." },
    { "index": 1, "text": "2) HƯ GÌ ĐỔI NẤY NGAY VÀ LUÔN ..." }
  ]
}
```

**`POST /admin/policies/confirm`** — bước 2: admin xác nhận sau khi xem preview
```json
// Request
{
  "preview_id": "prev_9f8a",
  "policy_type": "bảo_hành_đổi_trả",
  "title": "Chính sách bảo hành đổi trả",
  "replaces_policy_id": null
}
// Response
{
  "success": true,
  "policy_id": "pol_001",
  "chunks_embedded": 24,
  "message": "Đã cập nhật, AI sẽ dùng dữ liệu mới ngay lập tức"
}
```
`replaces_policy_id` do hệ thống TỰ ĐIỀN sau khi phát hiện trùng `policy_type` với tài liệu đang active và admin xác nhận cảnh báo — admin KHÔNG tự tìm/nhập ID thủ công. Nếu `replaces_policy_id` khác null → chunk của policy cũ được đánh dấu `deprecated: true`, không xoá hẳn.

### 3.3 Công cụ Demo (nội bộ, không public) — cũng là backend cho admin tab "Khuyến mãi"

**`POST /demo/trigger-alert`**
```json
// Request
{
  "customer_id": "demo_001",       // optional — không truyền/null → BROADCAST cho
                                    // TẤT CẢ khách đang online (dùng bởi tab "Khuyến
                                    // mãi", không có ô Customer ID trên UI)
  "product_id": "1751098000181",
  "alert_type": "PRICE_DROP",      // hoặc "BACK_IN_STOCK"
  "message": "Giảm ngay 20% cuối tuần này"  // optional — nội dung admin tự soạn
                                    // (tab "Khuyến mãi" ô "Nội dung chương trình"),
                                    // null thì dùng câu mặc định
}
// Response
{
  "success": true,
  "alert_id": "ALT_017",
  "pushed_via_websocket": true    // true nếu có ≥1 khách đang online nhận được
}
```
QUAN TRỌNG: endpoint này KHÔNG chỉ push notification — còn ghi THẬT vào bảng
`products`: `PRICE_DROP` → cập nhật `products.promotion` bằng đúng `message`;
`BACK_IN_STOCK` → cập nhật `stock_status='in_stock'` (+ `stock_quantity` mặc
định 10 nếu đang 0/null), kèm invalidate cache MCP ngay lập tức. Nhờ vậy các
lượt chat SAU đó (kể cả từ khách khác chưa từng nhận notification) đọc đúng
dữ liệu vừa cập nhật, không bị lệch giữa "thông báo đã gửi" và "data thật".

---

## 4. WEBSOCKET CONTRACT

**Kết nối:** `wss://{host}/ws?customer_id={customer_id}`

**Server → Client:**
```json
// Lúc kết nối thành công
{ "type": "CONNECTED", "customer_id": "demo_001", "timestamp": "2026-07-18T09:30:00+07:00" }

// Heartbeat mỗi 30s
{ "type": "PING", "timestamp": "2026-07-18T09:30:30+07:00" }

// Alert
{
  "type": "ALERT",
  "alert_id": "ALT_017",
  "priority": "HIGH",
  "customer_id": "demo_001",
  "product_id": "1751098000181",
  "product_name": "Máy lạnh Daikin Inverter 1.5HP",
  "alert_type": "PRICE_DROP",
  "message": "Giá đã giảm 18% so với lúc tư vấn",
  "old_price": 12500000,
  "new_price": 10250000,
  "source": { "system": "Product_API", "fetched_at": "2026-07-18T09:30:00+07:00" },
  "created_at": "2026-07-18T09:30:00+07:00"
}
```

---

## 5. DATA SCHEMA THAM CHIẾU (canonical — không định nghĩa lại)

Schema đầy đủ của 1 sản phẩm sau chuẩn hoá nằm ở **`data_normalization.md` mục 2** — API này chỉ tham chiếu, không lặp lại toàn bộ. Các field API hay dùng nhất: `product_code` (= product_id thống nhất), `product_name`, `category`, `brand`, `original_price`, `sale_price`, `rating`, `quantity_sold`, `specs{}`.

Schema `customer_memory` nằm ở **`flow_customer_memory.md`**: `{customer_id, slots_collected, products_discussed, conversation_summary, updated_at}`.

Bảng slot theo category (critical/optional, hard filter, scoring) nằm ở **`Flow_slot_filling.md` mục 2** — API `/api/chat` chỉ trả về giá trị đã điền, không lặp lại rule.

---

## 6. BẢO MẬT & LOG

- Mọi request/response ghi vào audit log PHẢI qua `mask_pii()` trước khi lưu (xem `log_masking.md`) — không log raw số điện thoại/email
- `original_price` KHÔNG BAO GIỜ đồng nghĩa với `cost_price` (giá vốn) — giá vốn không tồn tại trong bất kỳ response nào của hệ thống này
- `/admin/*` yêu cầu auth (session/token) — không public
- `/demo/trigger-alert` KHÔNG expose ra frontend khách hàng dưới bất kỳ hình thức nào, chỉ gọi qua curl/Postman nội bộ lúc demo