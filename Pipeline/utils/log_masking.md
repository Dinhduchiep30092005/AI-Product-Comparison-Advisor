Bất kỳ chỗ nào ghi log (audit log route: tool_calling|keyword,
MCP tool call log, prompt/response log nếu bật debug)
      ↓
Đi qua hàm mask_pii(text) TRƯỚC khi ghi, không ghi raw text
      ↓
mask_pii() áp dụng theo thứ tự (regex-based, không cần ML):
      │
      ├── Số điện thoại VN
      │     Pattern: (0|\+84)[0-9]{9,10}
      │     Giữ 3 số đầu + 2 số cuối, mask phần giữa (VD: 0912345678 → 091*****78)
      │     
      │
      ├── Email
      │     Pattern: [\w.+-]+@[\w-]+\.[\w.-]+
      │     Giữ ký tự đầu + domain, mask phần local còn lại (VD: nguyenvana@gmail.com → n********a@gmail.com)
      │     
      │
      ├── CCCD/CMND (12 hoặc 9 số liên tiếp, không phải giá tiền)
      │     Giữ 3 số đầu, mask phần còn lại (VD: 001234567890 → 001*********)
      │     
      │
      └── Tên riêng (khó regex chính xác 100%) → KHÔNG cố mask bằng regex (dễ false positive/negative), thay vào đó: field nào schema đã biết trước là "tên" (VD nếu sau này có form nhập tên cho trả góp) thì mask theo field, không mask theo nội dung tự do đoán mò
          
      ↓
Ghi bản đã mask vào log file/CloudWatch equivalent
      ↓
Dữ liệu GỐC (chưa mask) chỉ tồn tại trong session state / DB customer_memory (đã có access control riêng), KHÔNG bao giờ ra log
