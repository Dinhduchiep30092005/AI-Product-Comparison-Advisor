# Mục đích: Chỉ dùng để xử lý data từ file Spec_cate_gia.xlsx (nguồn tham khảo/đối chiếu — KHÔNG dùng để ingest vào hệ thống chính, vì nguồn canonical đã chuyển sang products_detail.json, xem data_normalization.md)

## Giá/tồn kho/KM: source_type=real-time
## Lưu ý: Khi hỏi bình thường thì trả lời như dữ liệu trong data. Khi cập nhật lại giá (hay những phần khác) trên dashboard admin -> giá cập nhật realtime -> AI dùng data cập nhật đó để trả lời

## Thông số về tồn kho, review sản phẩm được thêm từ dashboard admin

## Dùng code convert 14 sheet --> JSON (product_id đặt là sku, dùng riêng cho pipeline đối chiếu này, KHÔNG liên quan tới product_id/product_code của pipeline chính — xem data_normalization.md)
    - Viết script đọc từ sheet trong file Excel chuẩn hoá về 1 schema JSON thống nhất theo product dạng như trong ví dụ:
                {
            "product_id": "...",
            "category": "máy lạnh",
            "brand": "...",
            "specs": {
                "cong_suat": "1.5HP",
                "tieu_thu_dien": null,
                "do_on": "22dB"
            }
            }
    
    - field nào category không cõ thì đặt null


## Quy định về những phần không có thông tin
    - Về các dữ liệu không có (Trừ giá khuyến mãi): nếu file Excel không có các thông tin về giá gốc, thông tin sản phẩm thì xoá sản phẩm đó đi (JSON)

## Quy định về giá
    - Về giá gốc: 
        - Nếu file Excel không có thì xoá sản phẩm đó đi (không tải lên JSON)
        - Giá đầy đủ: giữ nguyên, CHỈ dùng để đối chiếu/QA với products_detail.json — KHÔNG đưa vào catalog_collection production. Pipeline production duy nhất là data_normalization.md (nguồn products_detail.json)
    - Về giá KM: xử lý theo flow (điều kiện bắt buộc là sản phẩm đó phải có giá gốc): 
                                    Với mỗi sheet category:
                                    ↓
                                1. Split field "khuyến mãi quà" theo dấu "|" thành các fragment riêng
                                    ↓
                                2. Đếm tần suất xuất hiện của mỗi fragment (exact match, toàn sheet)
                                    ↓
                                3. Đặt ngưỡng (VD >50% số sản phẩm trong sheet có cùng fragment y hệt)
                                    ├── Vượt ngưỡng → xem là VOUCHER CHUNG toàn hệ thống
                                    │       → KHÔNG gắn vào field promotion của từng sản phẩm
                                    │       → gộp lại 1 lần, đưa vào policy_collection (giống "chính sách chung", dùng cho search_policy chứ
                                    │         không phải get_product_promotion)
                                    │
                                    └── Dưới ngưỡng → xem là KHUYẾN MÃI RIÊNG của sản phẩm đó
                                            → giữ lại làm giá trị field "promotion" trong
                                                mock Promotion API cho đúng product_id