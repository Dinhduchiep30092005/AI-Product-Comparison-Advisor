# Mục đích: Chủ động báo khách khi giá giảm/hàng về lại, không cần khách tự hỏi lại

## Luồng hoạt động: 2 lớp phát hiện thay đổi (event-driven + polling dự phòng) → dedup → push qua WebSocket

### Input: products_discussed (từ customer_memory)

### Output: Notification real-time tới đúng khách (PRICE_DROP/BACK_IN_STOCK)


Container (Docker) chạy liên tục — on-premise, không phụ thuộc AWS
        ↓
Frontend khách kết nối WSS (dùng customer_id từ cookie, kể cả tài khoản demo)

        ↓
Phát hiện thay đổi giá/tồn kho — 2 lớp song song:
        │
        ├── LỚP 1 — Event-driven (chính, gần tức thời)
        │       Bất kỳ request nào đổi giá/tồn kho trong hệ thống nội bộ (VD PATCH /products/{id}/price qua demo trigger, hoặc sau này webhook thật nếu Product API hỗ trợ)
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
Khách click notification → mở lại đúng sản phẩm, đưa vào context chat