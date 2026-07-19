# Mục đích: Chủ động báo khách khi giá giảm/hàng về lại, không cần khách tự hỏi lại

## Luồng hoạt động: 2 lớp phát hiện thay đổi (event-driven + polling dự phòng) → dedup → push qua WebSocket

### Input: products_discussed (từ customer_memory)

### Output: Notification real-time tới đúng khách (PRICE_DROP/BACK_IN_STOCK)


Container (Docker) chạy liên tục — on-premise, không phụ thuộc AWS
        ↓
Frontend khách kết nối WSS (dùng customer_id từ localStorage, kể cả tài khoản demo)

        ↓
Phát hiện thay đổi giá/tồn kho — 2 lớp song song:
        │
        ├── LỚP 1 — Event-driven (chính, gần tức thời)
        │       Bất kỳ request nào đổi giá/tồn kho trong hệ thống nội bộ (VD PATCH /products/{id}/price qua admin dashboard, hoặc admin tab "Khuyến mãi" gọi POST /demo/trigger-alert, hoặc sau này webhook thật nếu Product API hỗ trợ)
        │       
        │       
        │             ↓
        │       Gọi thẳng check_alert(product_id) ngay lập tức (cùng process hoặc qua queue nhẹ như Redis pub/sub)
        │       
        │             ↓
        │       Đi thẳng xuống bước "Kiểm tra tiêu chí alert" bên dưới
        │
        └── LỚP 2 — Polling 60s (dự phòng)
                Bắt các thay đổi từ nguồn ngoài không có event báo trước (VD Product API thật của Điện Máy Xanh đổi giá mà không báo qua webhook)
                
                      ↓
                Scheduler kích hoạt polling mỗi 60 giây
                      ↓
                Alert Service lấy products_discussed của TẤT CẢ customer đang có (từ bảng customer_memory) → gọi Product API  theo batch
                                                                                                                                ├── GET /products/{id}/price
                                                                                                                                └── GET /products/{id}/stock
                      ↓
                Đi xuống bước "Kiểm tra tiêu chí alert" bên dưới
        ↓
Kiểm tra tiêu chí alert
        ├── Giá hiện tại < giá lúc tư vấn (lưu trong products_discussed) → PRICE_DROP
        │       
        └── Trạng thái hết hàng → còn hàng  → BACK_IN_STOCK
        │      
        ↓
So sánh với alert state/deduplication key trước đó
        ├── Alert mới hoặc thay đổi đáng kể → lưu alert,  WebSocket Server push tới đúng customer_id
        │  
        └── Không thay đổi → bỏ qua, chờ chu kỳ/event tiếp theo
        ↓
Browser khách nhận notification
        ↓
Khách click notification → gửi "Cho tôi xem lại sản phẩm {tên}" vào chat →
orchestrator resolve tên → product_id (xem Flow_general.md phần "Câu hỏi
TIẾP THEO", Flow_agent_loop.md) → mở lại đúng sản phẩm, đưa vào context chat


── Admin tab "Khuyến mãi" (Frontend/webapp/src/views/admin/DemoTab.tsx) ──

Dùng CHUNG cơ chế alert/WebSocket ở trên qua POST /demo/trigger-alert, KHÔNG
phải 1 hệ thống khuyến mãi tách biệt:

      - Admin chọn sản phẩm + loại sự kiện (Giảm giá=PRICE_DROP hoặc Có hàng
        trở lại=BACK_IN_STOCK) + tự soạn "Nội dung chương trình" (message)
      - KHÔNG có ô Customer ID (đã bỏ) → customer_id luôn để trống trong
        request → backend BROADCAST cho TẤT CẢ khách đang online qua
        ws_manager.broadcast() (alerts.force_alert_broadcast), thay vì chỉ
        1 khách như force_alert() — dedup_key dùng sentinel "ALL" thay vì
        customer_id thật
      - QUAN TRỌNG: kích hoạt sự kiện KHÔNG chỉ bắn thông báo — còn ghi
        THẬT vào bảng products (alerts._apply_to_product): PRICE_DROP →
        UPDATE products.promotion = message; BACK_IN_STOCK → UPDATE
        stock_status='in_stock' (+ stock_quantity mặc định 10 nếu đang
        0/null) — kèm invalidate cache MCP ngay. Nếu chỉ bắn alert mà
        không ghi data thật, chatbot tư vấn NGAY SAU đó vẫn đọc dữ liệu cũ
        (VD báo "không có khuyến mãi") dù khách vừa nhận thông báo KM qua
        WebSocket, gây mâu thuẫn — đây là bug thực tế đã gặp và sửa.