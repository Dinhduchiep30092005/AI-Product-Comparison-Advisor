import { useEffect, useRef, useState } from 'react';
import { sendChat } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { ProductCardData, SourceCitation } from '../../lib/types';
import { BotBubble, ErrorBubble, UserBubble } from './MessageBubble';
import { ProductCard } from './ProductCard';
import { InputBar } from './InputBar';
import { RightPanel } from './RightPanel';
import { ToastAlerts, ConnectionBanner } from './ToastAlerts';

type ChatMessage =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'bot'; text: string; sources?: SourceCitation[]; assumedFields?: string[] }
  | {
      id: string;
      kind: 'products';
      text: string;
      products: ProductCardData[];
      excludedNote: string | null;
      paymentNote: string | null;
    }
  | { id: string; kind: 'error'; text: string; retryText: string };

function getCustomerId(): string {
  const stored = localStorage.getItem('customer_id');
  if (stored) return stored;
  const fresh = 'cust_' + crypto.randomUUID().slice(0, 8);
  localStorage.setItem('customer_id', fresh);
  return fresh;
}

export function ChatView() {
  const [customerId] = useState(getCustomerId);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greeting',
      kind: 'bot',
      text: 'Xin chào! Em là trợ lý tư vấn điện máy. Anh/chị đang cần tìm sản phẩm gì ạ?',
    },
  ]);
  const [sending, setSending] = useState(false);
  const [panel, setPanel] = useState<{ mode: 'details' | 'compare'; product: ProductCardData | null } | null>(
    null,
  );
  const lastComparisonRef = useRef<ProductCardData[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const { toasts, dismissToast, showConnectionBanner, retry } = useWebSocket(customerId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, panel]);

  async function handleSend(text: string) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), kind: 'user', text }]);
    setSending(true);
    try {
      const data = await sendChat(customerId, text);
      if (data.type === 'PRODUCT_COMPARISON') {
        lastComparisonRef.current = data.products;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            kind: 'products',
            text: data.message,
            products: data.products,
            excludedNote: data.excluded_note,
            paymentNote: data.payment_note,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            kind: 'bot',
            text: data.message,
            sources: 'sources' in data ? data.sources : undefined,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'error',
          text: 'Không thể kết nối đến hệ thống. Vui lòng thử lại.',
          retryText: text,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleToastClick(t: { product_name: string }) {
    handleSend(`Cho tôi xem lại sản phẩm ${t.product_name}`);
  }

  const isSplit = panel !== null;

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans overflow-hidden">
      {showConnectionBanner && <ConnectionBanner onRetry={retry} />}
      <ToastAlerts toasts={toasts} onClick={handleToastClick} onDismiss={dismissToast} />

      <div className="h-16 bg-[#0056a3] shrink-0 flex items-center justify-between px-6 text-white shadow-md z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
            🤖
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">SmartBot</h2>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ffdd00]"></span>
              <span className="text-xs text-blue-100">Luôn sẵn sàng hỗ trợ</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div
          className={`flex flex-col h-full bg-[#f8fbff] transition-all duration-300 ease-in-out ${
            isSplit ? 'w-full md:w-2/5' : 'w-full'
          }`}
        >
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto">
              {messages.map((m) => {
                if (m.kind === 'user') return <UserBubble key={m.id} text={m.text} />;
                if (m.kind === 'bot') return <BotBubble key={m.id} text={m.text} sources={m.sources} />;
                if (m.kind === 'error')
                  return (
                    <ErrorBubble key={m.id} text={m.text} onRetry={() => handleSend(m.retryText)} />
                  );
                return (
                  <div key={m.id} className="flex flex-col items-start mb-4 max-w-[95%] w-full">
                    <BotBubble
                      text={m.text}
                      assumedFields={m.products[0]?.is_assumed_fields}
                    />
                    <div className="flex gap-3 overflow-x-auto w-full ml-10 mt-2 pb-2 hide-scrollbar">
                      {m.products.map((p) => (
                        <ProductCard
                          key={p.product_id}
                          product={p}
                          onDetails={(prod) => setPanel({ mode: 'details', product: prod })}
                        />
                      ))}
                    </div>
                    {m.products.length >= 2 && (
                      <button
                        onClick={() => setPanel({ mode: 'compare', product: null })}
                        className="ml-10 mt-1 px-3 py-1.5 rounded-full text-xs font-medium border border-[#0056a3] text-[#0056a3] hover:bg-blue-50"
                      >
                        So sánh các lựa chọn
                      </button>
                    )}
                    {m.excludedNote && (
                      <div className="ml-10 mt-2 text-[11px] text-gray-500 bg-gray-100 rounded-lg px-3 py-2 max-w-md">
                        Vì sao không chọn sản phẩm khác: {m.excludedNote}
                      </div>
                    )}
                    {m.paymentNote && (
                      <div className="ml-10 mt-2 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 max-w-md">
                        💳 {m.paymentNote}
                      </div>
                    )}
                  </div>
                );
              })}
              {sending && (
                <div className="ml-10 text-xs text-gray-400 italic">AI đang xử lý…</div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <InputBar onSend={handleSend} disabled={sending} />
        </div>

        {isSplit && (
          <div className="hidden md:block w-3/5 bg-gray-50 relative shadow-xl z-10">
            <RightPanel
              mode={panel.mode}
              product={panel.product}
              compareList={lastComparisonRef.current}
              onClose={() => setPanel(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
