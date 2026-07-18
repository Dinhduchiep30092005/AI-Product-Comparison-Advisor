# Chuẩn hoá dữ liệu: Tất cả dữ liệu từ JSON, dashboard admin hoặc API phải được chuyển về một schema chuẩn trước khi sử dụng trong backend, RAG hoặc Tool Registry

## Lưu ý: field `product_id` trong schema chuẩn này (VD"336956") là mã nội bộ crawl từ DMX, KHÔNG phải khóa chính hệ thống dùng. Toàn bộ MCP tool, cache key, session products_discussed, ChromaDB metadata... dùng field `product_code` (VD "0162791000229") làm định danh sản phẩm thống nhất. Khi code, mọi chỗ gọi biến tên "product_id" trong logic nghiệp vụ (Flow_MCP.md, Flow_RAG.md, flow_customer_memory.md) đều PHẢI trỏ tới giá trị `product_code` của schema này, không phải field `product_id`

1. Nguồn dữ liệu:
    Các nguồn có thể:
        - Spec_cate_gia.xlsx: dữ liệu sản phẩm theo từng sheet danh mục
        - products_detail.json: dữ liệu sản phẩm đã crawl và chuyển sang JSON
        - products_detail.xlsx: phiên bản Excel của dữ liệu sản phẩm
        - Dashboard Admin: dữ liệu giá, tồn kho, review và khuyến mãi được cập nhật
        - API runtime: dữ liệu thay đổi theo thời gian như giá, tồn kho và chương trình khuyến mãi
    Không coi các file có nội dung giống nhau nhưng khác định dạng là hai nguồn độc lập. Chỉ chọn một nguồn canonical để xử lý; các file còn lại dùng để kiểm tra hoặc xem dữ liệu.

2. Schema chuẩn
    Mỗi sản phẩm sau khi chuẩn hoá phải có dạng:
        { "product_id": "336956", 
        "product_code": "0162791000229", 
        "category_id": "14058", 
        "category": "quat_cac_loai", 
        "product_name": "Quạt cầm tay mini Hydrus JF-102", 
        "brand": "Hydrus", 
        "original_price": 390000, 
        "sale_price": 235000, 
        "rating": 4.9, 
        "quantity_sold": 14500, 
        "color": "Xanh Dương", 
        "accessories": null, 
        "warranty": "Không bảo hành. Đổi trả trong vòng 7 ngày nếu sản phẩm lỗi kỹ thuật.",
        "promotion": "Phiếu mua hàng mua Pin tiểu trị giá 20.000đ", 
        "outstanding_features": null, 
        "specs": { "loai_quat": "Quạt cầm tay", "muc_gio": "5 mức độ", "cong_sac": "Type C", "dung_luong_pin": "3000 mAh" }, 
        "image_url": "...", 
        "product_url": "...", 
        "online_sale_only": false, 
        "source": { "source_type": "catalog", "source_file": "products_detail.json", "updated_at": "2026-07-17T12:54:19" } }


3. Mapping tên trường (trường nguồn -> trường chuẩn)
    tên sản phẩm -> product_name
    category_name -> category
    productcode -> product_code
    Giá gốc -> original_price
    Giá khuyến mãi -> sale_price
    rating_vote -> rating
    màu sắc -> color
    Phụ kiện đi kèm -> accessories
    chính sách bảo hành -> warranty
    outstanding -> outstanding_features
    spec_product -> specs
    url_image -> image_url
    url -> product_url
    onlineSaleOnly -> online_sale_only

Không cho phép backend sử dụng trực tiếp tên trường gốc sau khi quá trình chuẩn hoá hoàn tất.

4. Chuẩn hoá dữ liệu rỗng
    Các giá trị sau được coi là không có dữ liệu
    "
    " "
    NaN
    N/A
    None
    null

    -> Tất cả phải chuyển thành: null

5. Chuẩn hoá dữ liệu
    - product_id, product_code: luôn lưu dưới dạng string
    - Giá: integer, đơn vị VNĐ (Việt Nam đồng), không chứa dấu phân cách
    - rating: float hoặc null 
    - stock_quantity: integer hoặc null (tồn kho, khác quantity_sold — số lượng đã bán)
    - Trường boolean chỉ nhận true hoặc false
    - Thời gian dùng chuẩn ISO 8601
    - Không lưu NaN trong JSON

6a. Chuẩn hoá text
    - Decode HTML entity:
        - AVA&#x2B; → AVA+
        - Lock&amp;Lock → Lock&Lock
    - Xoá khoảng trắng thừa
    - Chuẩn hoá Unicode tiếng Việt
    - Không tự sửa tên model hoặc mã sản phẩm
    - Giữ nguyên giá trị gốc trong raw_value nếu việc chuẩn hoá có khả năng gây mất thông tin

6b. Tách voucher chung khỏi promotion riêng sản phẩm
    - Với field "promotion" (split theo dấu ";"):
        1. Đếm tần suất mỗi fragment (exact match, toàn bộ 13.754 sản phẩm)
        2. Fragment xuất hiện >50% tổng số sản phẩm có promotion → voucher
        chung toàn hệ thống → tách ra, đưa vào policies.json (không
        phải file products.json), dùng cho search_policy
        3. Fragment còn lại (dưới ngưỡng) → giữ làm giá trị "promotion"
        thật của sản phẩm đó trong products.json

7. Chuẩn hoá thông số kỹ thuật
    - Tên thông số phải được chuyển sang key chuẩn dạng snake_case

    Ví dụ:
        "Công suất" → "cong_suat"
        "Độ ồn" → "do_on"
        "Dung lượng pin" → "dung_luong_pin"
        "Kích thước màn hình" → "kich_thuoc_man_hinh"

    - Mỗi category có thể có tập thông số riêng. Không bắt buộc mọi sản phẩm phải có tất cả thông số của category
    - Thông số không tồn tại: LUÔN giữ key trong specs{} với giá trị null, KHÔNG bỏ key. Nhất quán với quy tắc chuẩn hoá dữ liệu rỗng → null (mục 4); guardrail check dựa vào field_name có mặt trong claim rồi tra giá trị, nên bỏ key sẽ làm guardrail không nhận diện được field

8. Định danh và chống trùng lặp
    - Ưu tiên khoá định danh theo thứ tự:
        product_id
        product_code
        Tổ hợp brand + product_name

    - Nếu hai bản ghi có cùng product_id:
        Giữ bản ghi có updated_at mới hơn
        Ghi lại conflict vào validation report
        Không âm thầm ghi đè khi hai bản ghi khác nhau về tên sản phẩm hoặc mã sản phẩm

9. Thứ tự ưu tiên nguồn

    - Khi cùng một trường tồn tại ở nhiều nguồn:

            Dashboard Admin / API runtime
                    ↓
            File catalog mới nhất
                    ↓
            File catalog cũ
                    ↓
            RAG document

    - Giá, tồn kho và khuyến mãi phải ưu tiên nguồn runtime.
    - Thông số kỹ thuật, tên sản phẩm và thương hiệu ưu tiên catalog đã chuẩn hoá.
    - Không dùng dữ liệu trong vector database để ghi đè giá hoặc tồn kho runtime.

10. Kiểm tra sau chuẩn hoá

    - Script phải tạo validation report gồm:
        Tổng số sản phẩm đầu vào.
        Tổng số sản phẩm hợp lệ.
        Số sản phẩm bị loại.
        Số product_id trùng.
        Số sản phẩm thiếu giá gốc.
        Số sản phẩm thiếu tên.
        Số trường không map được.
        Số conflict giữa các nguồn.
        Số sản phẩm có giá khuyến mãi lớn hơn giá gốc.

    - Pipeline chỉ được coi là thành công khi:

        Không có product_id trùng chưa xử lý.
        Không có giá âm.
        Không có sale_price > original_price.
        Không có NaN trong JSON đầu ra.
        Tất cả sản phẩm đều có product_id, product_name, category và original_price.
11. File đầu ra

    - Pipeline tạo các file:
        data/processed/products.json
        data/processed/promotions.json
        data/processed/policies.json
        data/reports/data_validation_report.json
        data/reports/data_conflicts.json

    - products.json là nguồn canonical cho backend và quá trình tạo vector database.

    Các file Excel và JSON gốc chỉ được lưu trong data/raw/, không được backend truy cập trực tiếp.