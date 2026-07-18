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