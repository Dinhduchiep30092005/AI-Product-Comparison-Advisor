# Mục đích: Cho phép admin (không cần biết code) tự cập nhật chính sách/tài liệu lên knowledge base của bot, không cần đợi ingest thủ công qua script

## Luồng hoạt động: Admin upload qua Admin UI → parse & chuẩn hoá → chunk theo cấu trúc thật → embed → lưu vào policy_collection → bot dùng ngay cho search_policy (không cần restart/deploy lại)

### Input: File PDF/DOCX/TXT/Markdown, hoặc admin gõ trực tiếp nội dung
### Output: Chunk đã embed trong policy_collection, có metadata policy_type + nguồn, sẵn sàng cho RAG

        Admin
        ↓
Vào Admin UI → mục "Quản lý chính sách" → Upload file hoặc nhập nội dung trực tiếp (textarea)
       ↓
Backend parse theo loại file:
        - PDF/DOCX → dùng thư viện parse (pdfplumber/python-docx) →
          trích text thô
        - TXT/Markdown → đọc trực tiếp
        - Nhập tay → dùng luôn nội dung admin gõ
        ↓
Chuẩn hoá text (decode HTML entity nếu có, xoá khoảng trắng thừa, chuẩn hoá Unicode tiếng Việt — dùng chung logic với data_normalization.md mục 6a)
        ↓
Chunking theo cấu trúc — KHÔNG chunk theo độ dài cố định:
        - Nếu văn bản có mục/điều đánh số rõ ràng (VD "1)", "Điều 1", "ĐIỀU KIỆN ÁP DỤNG") → chunk theo từng mục/điều
        - Nếu văn bản ngắn, liền mạch (không có cấu trúc mục rõ) → giữ nguyên 1-2 chunk, không cắt vụn vô nghĩa
        - Admin có thể xem trước danh sách chunk đã tách (preview) trước khi confirm lưu — tránh chunk sai cấu trúc mà không ai biết
        ↓
Admin gán policy_type cho tài liệu (dropdown có sẵn: bảo_hành_đổi_trả, giao_hàng_lắp_đặt, bảo_mật_dữ_liệu, điều_khoản_sử_dụng, chăm_sóc_khách_hàng, hoặc "Khác" nếu không khớp — không bắt admin tự nghĩ ra category mới ngoài danh sách, tránh loạn taxonomy)
        ↓
Embedding bằng Vietnamese_Embedding → lưu vào policy_collection (ChromaDB), metadata: {policy_type, source_file/tên tài liệu, uploaded_by (admin), uploaded_at, version (nếu là bản cập nhật đè lên tài liệu cũ cùng policy_type)}
        ↓
Khi admin upload tài liệu mới cùng policy_type với tài liệu đang active → hệ thống TỰ PHÁT HIỆN trùng → hiển thị cảnh báo cho admin xác nhận → nếu admin xác nhận, hệ thống TỰ ĐIỀN `replaces_policy_id` = ID tài liệu cũ (admin KHÔNG tự tra/nhập ID thủ công) → đánh dấu chunk cũ là deprecated=true (không xoá hẳn, giữ lịch sử) thay vì để 2 phiên bản cùng match song song gây nhầm lẫn cho RAG
        ↓
search_policy (tool) và vector search trực tiếp (Flow_RAG.md bước 3)
CHỈ query chunk có deprecated=false
        ↓
Bot dùng ngay cho lượt chat tiếp theo — KHÔNG cần deploy lại