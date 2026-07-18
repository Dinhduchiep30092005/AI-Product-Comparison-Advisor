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
