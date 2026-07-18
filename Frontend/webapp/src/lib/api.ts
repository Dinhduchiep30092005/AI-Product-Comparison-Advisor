import type { AlertPayload, ChatResponse } from './types';

export async function sendChat(customerId: string, message: string): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customerId, message }),
  });
  if (!res.ok) throw new Error('http ' + res.status);
  return res.json();
}

/** Mirrors app/static/chat.js: auto-reconnect every 3s on close. Returns a cleanup fn. */
export function connectWS(
  customerId: string,
  onAlert: (a: AlertPayload) => void,
  onStatusChange?: (status: 'open' | 'closed') => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?customer_id=${customerId}`);
    ws.onopen = () => onStatusChange?.('open');
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'ALERT') onAlert(data);
    };
    ws.onclose = () => {
      onStatusChange?.('closed');
      if (!closed) retryTimer = setTimeout(connect, 3000);
    };
  }
  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close();
  };
}
