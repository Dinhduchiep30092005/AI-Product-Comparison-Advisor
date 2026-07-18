

# Đề bài: AI Product Comparison Advisor Based on Real Customer Needs (Lưu nguyên văn đề bài, dùng để đối chiếu khi thiết kế các file khác)

## Vấn đề cần giải quyết

- Khách hàng hỏi bằng ngôn ngữ tự nhiên, ví dụ: “Máy lạnh dưới 20 triệu cho phòng 18m², tiết kiệm điện, ít ồn”.
- AI phải hỏi ngược khi thiếu thông tin quan trọng, không trả lời vội bằng danh sách sản phẩm.
- Hệ thống phải truy xuất dữ liệu catalog, giá, tồn kho, khuyến mãi và review thật bằng RAG hoặc API, tuyệt đối không tự bịa.
- Đề xuất top 3 sản phẩm phù hợp nhất.
- Giải thích rõ lý do lựa chọn, ưu điểm, hạn chế và trade-off bằng ngôn ngữ dễ hiểu, không dùng quá nhiều thuật ngữ kỹ thuật hoặc marketing.
- Mỗi đề xuất phải có nguồn dữ liệu.
- Khi không có thông tin về giá, tồn kho hoặc khuyến mãi, AI phải nói rõ chưa có dữ liệu thay vì suy đoán.

## Yêu cầu xử lý ngôn ngữ

- Hỗ trợ tiếng Việt tự nhiên.
- Hiểu câu có dấu, không dấu, văn nói, viết tắt và ngôn ngữ mua sắm phổ thông.
- Xử lý được lỗi chính tả, từ địa phương và cách diễn đạt không chuẩn.
- Hiểu các đơn vị đo và thuật ngữ như m², HP, BTU, GB, lít, inch.
- Giải thích thông số kỹ thuật bằng ngôn ngữ dễ hiểu cho khách hàng phổ thông.
- Ưu tiên xử lý code-switching Việt–Anh trong tên sản phẩm, thông số và review.

## Context địa phương

### Giao tiếp và văn hóa

- Giao tiếp lịch sự, gần gũi bằng tiếng Việt.
- Không tạo cảm giác ép mua.
- Không phóng đại công dụng hoặc ưu điểm của sản phẩm.

### Pháp lý và bảo vệ dữ liệu

- Tuân thủ yêu cầu bảo vệ dữ liệu khách hàng nếu sử dụng dữ liệu thật.
- Không lưu dữ liệu khách hàng thật khi chưa được phép.
- Log phải che hoặc mask thông tin nhạy cảm.
- Không hiển thị dữ liệu nội bộ như giá vốn.
- Dữ liệu thật phải được anonymize hoặc sử dụng theo thỏa thuận phù hợp.

### Địa lý và cửa hàng

- Ưu tiên hiểu khu vực hoặc cửa hàng để kiểm tra tồn kho.
- Có thể sử dụng vị trí để tư vấn giao hàng hoặc lắp đặt khi có dữ liệu.

### Dữ liệu thị trường Việt Nam

- Hiểu tiền tệ VND.
- Hiểu giá khuyến mãi và giá niêm yết.
- Hiểu hình thức trả góp.
- Hiểu các đơn vị đo và đặc thù sản phẩm điện máy, điện thoại tại Việt Nam.

### Logic tư vấn theo ngành hàng

- Tủ lạnh: số người sử dụng, dung tích tổng, số cửa, điện năng tiêu thụ, công nghệ tiết kiệm điện, công nghệ bảo quản thực phẩm, kiểu dáng.
- Máy lạnh: diện tích phòng suy ra từ công suất đầu ra, loại máy (treo tường/âm trần/tủ đứng), độ ồn, nhãn năng lượng, loại Inverter, phạm vi sử dụng, chế độ gió.
- Máy giặt: số người sử dụng suy ra khối lượng tải chính, loại Inverter, công nghệ sấy tích hợp, lồng giặt, tốc độ quay vắt, chương trình giặt.
- Máy sấy quần áo: khối lượng tải chính, công nghệ (bơm nhiệt hay thông thường), cảm biến độ ẩm, nhiệt độ sấy tối đa.
- Máy rửa chén: số bộ chén (số lượng), công nghệ rửa/sấy, độ ồn, mức tiêu thụ nước, chương trình rửa.
- Tủ mát, tủ đông: dung tích tổng, số cửa/số ngăn, nhiệt độ ngăn đông, mục đích sử dụng (gia đình hay kinh doanh), độ ồn.
- Máy nước nóng: loại máy (trực tiếp/gián tiếp), công suất đầu ra, dung lượng bình chứa, áp lực nước hoạt động, tính năng an toàn, bơm trợ lực.
- Micro karaoke: loại sản phẩm (có dây/không dây), tần số hoạt động, băng tần, độ méo tiếng.
- Micro thu âm điện thoại: loại kết nối, thời gian hoạt động bộ thu/phát, khoảng cách truyền, thiết bị tương thích (iOS/Android), hướng thu âm.
- Đồng hồ thông minh: nhu cầu theo dõi sức khỏe/thể thao, định vị GPS, SIM/thực hiện cuộc gọi độc lập, thời gian dùng pin, chuẩn chống nước/bụi, chất liệu dây đeo.
- Máy tính để bàn: mục đích sử dụng (văn phòng/gaming/đồ họa) suy ra loại CPU và tốc độ CPU, dung lượng RAM, loại ổ cứng, chip đồ họa GPU.
- Màn hình máy tính: mục đích (văn phòng/gaming/đồ họa) suy ra kích thước và độ phân giải, loại tấm nền, thời gian đáp ứng, độ phủ màu, cổng kết nối.
- Máy in: nhu cầu in ấn (văn phòng/gia đình) suy ra công nghệ in (laser/phun), tốc độ in, loại mực in, khổ giấy, khả năng in 2 mặt, kết nối (wifi/dây).
- Máy tính bảng: mục đích sử dụng (học tập/giải trí/vẽ) suy ra kích thước màn hình, chip xử lý, RAM, dung lượng lưu trữ, có SIM/mạng di động hay không, dung lượng pin.

## Yêu cầu hạ tầng và hiệu năng

### Môi trường triển khai

- Giải pháp có thể chạy on-premise/cloud.
- Có kiến trúc rõ ràng, dễ chạy lại và có khả năng triển khai thực tế.
- Không bắt buộc sử dụng một ngôn ngữ lập trình hoặc framework cụ thể.

### Kết nối và thiết bị

- Bắt buộc có internet cho demo web và gọi API.
- Người dùng cuối truy cập bằng web browser.

### Tốc độ phản hồi

- Phản hồi câu hỏi gợi ý hoặc câu hỏi làm rõ trong dưới 3 giây với dữ liệu demo.
- So sánh và đề xuất top 3 sản phẩm trong dưới 5 giây.

### API cần tích hợp

- Product Catalog API hoặc dữ liệu catalog mock tương đương.
- Price API.
- Promotion API.
- Stock API.
- Có thể tích hợp thêm Review API và Policy/FAQ data.

## Luồng giải pháp lý tưởng

Một khách hàng truy cập website bán lẻ và hỏi:

> “Em muốn mua máy lạnh dưới 20 triệu cho phòng 18m², tiết kiệm điện, ít ồn.”

Thay vì trả lời ngay bằng một danh sách sản phẩm khô khan, AI cần hỏi thêm một số câu quan trọng:

- Đây là phòng ngủ hay phòng khách?
- Phòng có bị nắng trực tiếp không?
- Khu vực lắp đặt ở đâu?
- Khách hàng ưu tiên chạy êm hay làm lạnh nhanh?
- Có quan tâm đến trả góp hoặc chương trình khuyến mãi không?

Sau khi có đủ thông tin, AI thực hiện:

1. Truy xuất catalog sản phẩm.
2. Kiểm tra giá bán.
3. Kiểm tra khuyến mãi.
4. Kiểm tra tồn kho.
5. Truy xuất review và chính sách liên quan.
6. Lọc các sản phẩm không đáp ứng điều kiện bắt buộc.
7. Chấm điểm và xếp hạng sản phẩm.
8. Đề xuất top 3 sản phẩm phù hợp nhất.
9. Giải thích ưu điểm, hạn chế và trade-off của từng sản phẩm.
10. Hiển thị nguồn dữ liệu cho từng thông tin quan trọng.

Ví dụ phần giải thích cần cho biết:

- Sản phẩm nào chạy êm hơn và phù hợp với phòng ngủ.
- Sản phẩm nào tiết kiệm điện hơn.
- Sản phẩm nào có mức giá tốt hơn.
- Sản phẩm nào làm lạnh nhanh hơn.
- Sản phẩm nào không nên chọn vì công suất thấp hoặc không phù hợp với phòng nhiều nắng.

Giải pháp phải sử dụng cách diễn đạt bình dân, giúp khách hàng phổ thông hiểu được sự khác biệt giữa các lựa chọn.

## Guardrail chống hallucination

- Không tự tạo thông số kỹ thuật.
- Không tự tạo giá bán.
- Không tự tạo khuyến mãi.
- Không tự tạo tình trạng tồn kho.
- Không khẳng định dữ liệu khi nguồn không có.
- Chỉ sử dụng thông tin từ catalog, API, tài liệu chính sách hoặc dữ liệu được cung cấp.
- Khi dữ liệu thiếu, phải trả lời rõ:
  - “Hiện chưa có dữ liệu giá.”
  - “Chưa xác định được tồn kho tại khu vực này.”
  - “Không tìm thấy thông tin về chương trình khuyến mãi.”
- Mỗi thông tin thực tế cần lưu source metadata để có thể hiển thị citation.

## Các trường hợp không được đánh giá cao

- Chỉ hoạt động với dữ liệu sạch hoặc lý tưởng.
- Không xử lý được sản phẩm thiếu field, sai đơn vị hoặc mô tả không đồng nhất.
- Bắt người dùng phải tự hiểu bảng thông số kỹ thuật phức tạp.
- Chỉ hiển thị danh sách hoặc bảng so sánh mà không giải thích theo nhu cầu.
- Phụ thuộc hoàn toàn vào API nước ngoài đắt đỏ hoặc không ổn định.
- Demo chỉ là mockup hoặc slideshow, không có AI truy xuất và so sánh dữ liệu phía sau.
- Không có cơ chế tích hợp catalog, giá, tồn kho, khuyến mãi hoặc review.
- Chatbot trả lời chung chung và sản phẩm nào cũng nói tốt.
- Không hỏi lại khi thiếu thông tin quan trọng.
- Bịa giá, tồn kho, khuyến mãi hoặc thông số.
- Không có nguồn dữ liệu cho câu trả lời.
- Không có kế hoạch triển khai thực tế.

## Kết quả mong muốn

- Khách hàng ra quyết định nhanh và tự tin hơn.
- Câu trả lời tập trung vào lợi ích sử dụng thực tế.
- Giảm tải các câu hỏi lặp lại cho nhân viên tư vấn.
- Hỗ trợ tăng tỷ lệ chuyển đổi trên kênh bán hàng online.
- Có khả năng tích hợp thực tế với hệ thống catalog, giá, tồn kho và khuyến mãi của doanh nghiệp.