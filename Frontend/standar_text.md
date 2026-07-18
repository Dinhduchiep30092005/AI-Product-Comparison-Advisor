## Quy định về text giao diện khi trả lời

Chat bubble hiện tại: render text thô
      ↓
Đổi thành: dùng thư viện parse Markdown (react-markdown + remark-gfm
nếu React, hoặc marked.js nếu vanilla JS) để render đúng bong bóng AI
      ↓
Style lại các thẻ HTML sinh ra từ markdown theo design system:
  **text** → <strong> → font-weight: 600, không đổi màu (tránh
    lẫn với link)
  *text* → <em> → in nghiêng, dùng cho ghi chú phụ (VD "giá đã bao
    gồm VAT")
  Danh sách số (1. 2. 3.) → <ol> → thụt lề rõ, khoảng cách dòng
    rộng hơn text thường
  Emoji (💰🖥️🎁) → giữ nguyên, không cần xử lý gì thêm