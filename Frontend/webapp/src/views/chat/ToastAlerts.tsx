import { fmtPrice, fmtTime } from '../../lib/format';
import type { AlertPayload } from '../../lib/types';

export interface ToastItem extends AlertPayload {
  id: string;
}

export function ToastAlerts({
  toasts,
  onClick,
  onDismiss,
}: {
  toasts: ToastItem[];
  onClick: (t: ToastItem) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            onClick(t);
            onDismiss(t.id);
          }}
          className="bg-white border border-gray-200 shadow-lg rounded-xl p-3 text-sm cursor-pointer hover:border-[#0056a3] transition-colors"
        >
          🔔 <b>{t.product_name}</b>
          <br />
          {t.message}
          {t.new_price != null && (
            <div className="font-bold mt-1">
              {fmtPrice(t.old_price)} → {fmtPrice(t.new_price)}
            </div>
          )}
          <div className="text-[11px] text-gray-400 mt-1">
            Nguồn: {t.source.system} — {fmtTime(t.source.fetched_at)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs px-4 py-2 flex items-center justify-between">
      <span>Mất kết nối realtime — thông báo giá/tồn kho có thể bị chậm.</span>
      <button onClick={onRetry} className="font-medium underline">
        Thử lại
      </button>
    </div>
  );
}
