import { useState } from 'react';
import { Zap } from 'lucide-react';
import { triggerDemoAlert } from '../../lib/adminApi';

export function DemoTab() {
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [alertType, setAlertType] = useState<'PRICE_DROP' | 'BACK_IN_STOCK'>('PRICE_DROP');
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; text: string }>({
    kind: 'idle',
    text: '',
  });

  async function trigger() {
    if (!customerId.trim() || !productId.trim()) {
      setStatus({ kind: 'err', text: 'Nhập customer_id và product_id.' });
      return;
    }
    setStatus({ kind: 'busy', text: 'Đang kích hoạt…' });
    try {
      const res = await triggerDemoAlert(customerId.trim(), productId.trim(), alertType);
      setStatus({
        kind: 'ok',
        text:
          `Đã kích hoạt sự kiện ${alertType}` +
          (res.pushed_via_websocket ? ' — đã push qua WebSocket.' : ' — khách chưa online, alert đã lưu.'),
      });
    } catch (e) {
      setStatus({ kind: 'err', text: (e as Error).message });
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-xl space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <Zap className="w-5 h-5 text-dmx-blue" />
        <h2 className="text-lg font-bold text-slate-800">Công cụ Demo</h2>
      </div>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Công cụ này chỉ phục vụ demo và không thuộc luồng vận hành chính thức.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Customer ID</label>
        <input
          type="text"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="cust_xxxxxxxx"
          className="w-full p-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Product ID</label>
        <input
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Sự kiện</label>
        <select
          value={alertType}
          onChange={(e) => setAlertType(e.target.value as 'PRICE_DROP' | 'BACK_IN_STOCK')}
          className="w-full p-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="PRICE_DROP">Giảm giá</option>
          <option value="BACK_IN_STOCK">Có hàng trở lại</option>
        </select>
      </div>

      {status.text && (
        <div
          className={`text-sm ${
            status.kind === 'err' ? 'text-red-600' : status.kind === 'ok' ? 'text-green-600' : 'text-slate-500'
          }`}
        >
          {status.text}
        </div>
      )}

      <button
        onClick={trigger}
        disabled={status.kind === 'busy'}
        className="px-6 py-2 bg-dmx-yellow text-slate-800 rounded-lg font-medium hover:bg-dmx-yellow-hover disabled:opacity-60"
      >
        Kích hoạt sự kiện
      </button>
    </div>
  );
}
