import { useEffect, useRef, useState } from 'react';
import { connectWS } from '../lib/api';
import type { AlertPayload } from '../lib/types';
import type { ToastItem } from '../views/chat/ToastAlerts';

/** Tracks consecutive close events to distinguish a normal reconnect blip
 * from a genuinely dead connection worth surfacing to the user. */
const CONSECUTIVE_FAILURES_BEFORE_BANNER = 3;

export function useWebSocket(customerId: string | null) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showConnectionBanner, setShowConnectionBanner] = useState(false);
  const failCountRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const connect = () => {
    if (!customerId) return;
    cleanupRef.current?.();
    cleanupRef.current = connectWS(
      customerId,
      (alert: AlertPayload) => {
        setToasts((prev) => [...prev, { ...alert, id: crypto.randomUUID() }]);
      },
      (status) => {
        if (status === 'open') {
          failCountRef.current = 0;
          setShowConnectionBanner(false);
        } else {
          failCountRef.current += 1;
          if (failCountRef.current >= CONSECUTIVE_FAILURES_BEFORE_BANNER) setShowConnectionBanner(true);
        }
      },
    );
  };

  useEffect(() => {
    connect();
    return () => cleanupRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const retry = () => {
    failCountRef.current = 0;
    setShowConnectionBanner(false);
    connect();
  };

  return { toasts, dismissToast, showConnectionBanner, retry };
}
