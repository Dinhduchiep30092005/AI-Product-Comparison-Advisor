# Mục đích: Giúp hệ thống "nhớ" khách qua nhiều lần quay lại, không chỉ trong 1 phiên chat

## Luồng hoạt động: Xác định customer_id (demo hoặc UUID mới) → load memory cũ từ DB trước khi xử lý → ghi lại state mới sau mỗi lượt

### Input: customer_id (localStorage của trình duyệt)

### Output: Slot + products_discussed + tóm tắt hội thoại được load/lưu vào DB

## Dùng SQLite (bảng `customer_memory` trong `app/data/app.db` — KHÔNG dùng Postgres)

Landing page
      ↓
Khách chọn 1 trong các lối vào:
      ├── "Chọn tài khoản demo" (dành cho giám khảo)
      │     → Danh sách nút cố định: "Khách A (đã hỏi máy lạnh)", "Khách B (đã hỏi tủ lạnh)", "Khách mới"
      │       
      │     → Click → set customer_id cố định (VD customer_id=demo_001) → vào thẳng chat
      │       
      │
      └── Khách thật (không qua demo)
            → Chưa có customer_id → sinh UUID mới (`cust_XXXXXXXX`), lưu localStorage,
              dùng lại cho các lần quay lại CÙNG trình duyệt/máy (không cross-device —
              xem Frontend/webapp/src/views/chat/ChatView.tsx getCustomerId())
              
      ↓
Mỗi lượt hội thoại → sau khi xử lý xong (slot-filling, RAG, trả lời):
      → Ghi vào bảng `customer_memory` (SQLite):
        {customer_id, slots_collected (JSON), products_discussed (list product_id + giá lúc tư vấn), conversation_summary, updated_at}
         
      → KHÔNG ghi full transcript — chỉ ghi state đã tổng hợp
      ↓
Khách quay lại (customer_id đã tồn tại)
      ↓
Load `customer_memory` từ DB TRƯỚC khi xử lý câu hỏi mới
      → Với tài khoản demo: dữ liệu này đã được SEED SẴN trước khi thi (không cần chat thật rồi mới có) — giám khảo chọn "Khách A" là thấy ngay hệ thống nhớ đã hỏi máy lạnh
        
      → Prepend vào session: slots đã biết, products_discussed (dùng cho phần Alert ở Phần 2)
        
      ↓
Xử lý câu hỏi mới như bình thường (Agent Loop + slot-filling)