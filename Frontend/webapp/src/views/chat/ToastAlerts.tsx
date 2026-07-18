import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { fmtPrice, fmtTime } from '../../lib/format';
import type { NotificationItem } from '../../lib/types';

export function NotificationBell({
  notifications,
  onItemClick,
  onDismiss,
  onOpen,
}: {
  notifications: NotificationItem[];
  onItemClick: (n: NotificationItem) => void;
  onDismiss: (id: string) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(notifications.length);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Alert mới về (khuyến mãi/giảm giá/có hàng trở lại) → tự mở khung popup,
  // không bắt khách phải chủ động bấm chuông mới thấy.
  useEffect(() => {
    if (notifications.length > prevCountRef.current) setOpen(true);
    prevCountRef.current = notifications.length;
  }, [notifications.length]);

  useEffect(() => {
    if (open) onOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  return (
    <div ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Thông báo"
        className="relative w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-16 right-0 w-96 max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl z-30">
          <div className="p-3 border-b bg-gray-50 font-bold text-gray-800 text-sm sticky top-0">Thông báo</div>
          {notifications.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">Chưa có thông báo nào.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...notifications].reverse().map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    onItemClick(n);
                    onDismiss(n.id);
                    setOpen(false);
                  }}
                  className="p-3 hover:bg-gray-50 cursor-pointer flex gap-3"
                >
                  <div className="shrink-0 w-8 h-8 rounded-full bg-blue-50 text-[#0056a3] flex items-center justify-center text-sm">
                    {n.alert_type === 'PRICE_DROP' ? '🎁' : '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{n.product_name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>
                    {n.new_price != null && (
                      <div className="text-xs font-bold text-[#0056a3] mt-1">
                        {fmtPrice(n.old_price)} → {fmtPrice(n.new_price)}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {n.source.system} — {fmtTime(n.source.fetched_at)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(n.id);
                    }}
                    className="text-gray-300 hover:text-gray-500 text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
