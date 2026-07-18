import { useEffect, useRef, useState } from 'react';
import { connectWS } from '../lib/api';
import type { AlertPayload, NotificationItem } from '../lib/types';

/** Tracks consecutive close events to distinguish a normal reconnect blip
 * from a genuinely dead connection worth surfacing to the user. */
const CONSECUTIVE_FAILURES_BEFORE_BANNER = 3;

export function useWebSocket(customerId: string | null) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showConnectionBanner, setShowConnectionBanner] = useState(false);
  const failCountRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const connect = () => {
    if (!customerId) return;
    cleanupRef.current?.();
    cleanupRef.current = connectWS(
      customerId,
      (alert: AlertPayload) => {
        setNotifications((prev) => [...prev, { ...alert, id: crypto.randomUUID(), read: false }]);
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

  const dismissNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const retry = () => {
    failCountRef.current = 0;
    setShowConnectionBanner(false);
    connect();
  };

  return { notifications, dismissNotification, markAllRead, showConnectionBanner, retry };
}
