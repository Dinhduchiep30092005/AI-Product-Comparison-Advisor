# Mục đích: Bảng định nghĩa từng MCP tool cụ thể (tên, mục đích, input, output) để LLM/code gọi đúng

get_product_price - Lấy giá hiện tại của sản phẩm - product_id - giá, đơn vị tiền, timestamp
get_product_stock - Kiểm tra tồn kho - product_id, store_id - số lượng còn, tình trạng hàng (còn/hết)
get_product_promotion - lấy khuyến mãi đang áp dụng - product_id - tên khuyến mãi, % giảm / quà tặng, hạn
search_policy - tra cứu chính sách (bảo hành, trả hàng, giao hàng) - câu hỏi hoặc policy_type - đoạn chính sách liên quan
get_product_review - Lấy tóm tắt đánh giá của sản phẩm - product_id - điểm đánh giá trung bình, số lượt đánh giá, 1-2 câu tóm tắt nhận xét nổi bật (ưu điểm/nhược điểm khách hàng hay nhắc tới)