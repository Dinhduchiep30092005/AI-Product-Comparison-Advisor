export function fmtPrice(v: number | null | undefined): string {
  return v == null ? '—' : v.toLocaleString('vi-VN') + 'đ';
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return (
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
    ' ' +
    d.toLocaleDateString('vi-VN')
  );
}

/** Dữ liệu khuyến mãi crawl thô dùng lẫn lộn "|" và ";" làm dấu phân tách, và
 * lẫn cả text "Xem chi tiết" của link gốc trên trang DMX. Tách thành từng dòng
 * gọn để hiển thị dạng danh sách thay vì 1 đoạn văn dài. */
export function parsePromotionItems(raw: string): string[] {
  return raw
    .split(/[|;]/)
    .map((s) => s.replace(/xem chi tiết/gi, '').trim())
    .map((s) => s.replace(/^[:.,]+|[:.,]+$/g, '').trim())
    .filter(Boolean);
}

/** Tóm tắt so sánh "Ưu điểm - Phù hợp" cho từng sản phẩm, dựng lại từ
 * pros/explanation mà AI đã sinh sẵn khi tư vấn (không gọi thêm LLM). */
export function buildComparisonSummary(products: { product_name: string; pros: string[]; explanation: string }[]): string {
  const sections = products.map((p) => {
    const pros =
      p.pros.length > 0
        ? p.pros.map((x) => `- ${x}`).join('\n')
        : '- Chưa có dữ liệu ưu điểm nổi bật.';
    const fit = p.explanation.trim() || 'Chưa có đánh giá mức độ phù hợp.';
    return `**${p.product_name}**\n\n✅ *Ưu điểm:*\n${pros}\n\n🎯 *Phù hợp:* ${fit}`;
  });
  return (
    'Dạ, em so sánh nhanh ưu điểm và mức độ phù hợp của từng lựa chọn để anh/chị dễ cân nhắc ạ:\n\n' +
    sections.join('\n\n---\n\n') +
    '\n\nAnh/chị muốn em tư vấn thêm chi tiết sản phẩm nào không ạ?'
  );
}
