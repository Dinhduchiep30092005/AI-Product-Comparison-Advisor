## Phương án deploy để nộp 

1. Deploy backend với docs_url=None → giám khảo (hoặc bất kỳ ai) vào
   URL, gõ /docs → 404, không thấy được danh sách API gì cả
        ↓
2. API endpoint /demo/trigger-alert (hoặc PATCH /products/{id}/price)
   VẪN gọi được bình thường — chỉ là không có giao diện để bấm nút, phải gọi bằng cách khác
        ↓
3. KHÔNG dùng Swagger UI trong bất kỳ trường hợp nào (đã build với docs_url=None ngay từ đầu, áp dụng cho mọi máy gọi vào server đó, kể cả máy bạn, không có phương án dự phòng bật lại). Thay vào đó, luôn dùng Postman/curl/script Python đã chuẩn bị sẵn để gọi thẳng API đó bằng URL + JSON body, không cần giao diện web nào cả
        ↓
4. Server nhận request → xử lý → trigger alert → push WebSocket
        ↓
5. Giám khảo thấy notification hiện trên chat UI của họ (tab 1)

## Docker build — dữ liệu phải có sẵn TRONG image, không tự re-ingest lúc chạy

Render free tier không đủ tài nguyên/thời gian để chạy pipeline
normalize → ingest_vectors → seed_demo lúc container khởi động, nên
`app/data/app.db` (SQLite: products/policies/customer_memory) và
`app/data/chroma` (vector index) PHẢI được build sẵn ở máy dev rồi
COMMIT thẳng vào git — `.gitignore` chỉ loại trừ file tạm/log của
chúng (`app.db-shm`, `app.db-wal`, `logs/`, `reports/`), KHÔNG loại
trừ `app.db`/`chroma` bản thân.

`Dockerfile` build 2 stage rồi `COPY . /app` (copy toàn bộ context,
trừ những gì `.dockerignore` liệt kê) — **`.dockerignore` PHẢI đồng bộ
với `.gitignore`**: từng có bug thực tế là `.dockerignore` loại trừ
luôn `app/data/app.db` và `app/data/chroma` (dù `.gitignore` cố tình
giữ lại 2 thứ này), khiến container deploy lên với database HOÀN TOÀN
RỖNG — dashboard admin hiện toàn số 0, chatbot không có dữ liệu tư vấn
— dù data vẫn nằm đúng trong git. Trước khi build/deploy, luôn kiểm
tra `.dockerignore` KHÔNG loại trừ `app/data/app.db` hay `app/data/chroma`.