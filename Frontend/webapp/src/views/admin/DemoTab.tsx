import { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import {
  listCategories,
  listProducts,
  triggerDemoAlert,
  type AdminProductListItem,
} from '../../lib/adminApi';

export function DemoTab() {
  const [customerId, setCustomerId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productResults, setProductResults] = useState<AdminProductListItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [alertType, setAlertType] = useState<'PRICE_DROP' | 'BACK_IN_STOCK'>('PRICE_DROP');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    function onOutsideClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [showPicker]);

  function runSearch(query: string, category: string) {
    listProducts(query.trim(), category, 1)
      .then((r) => setProductResults(r.products))
      .catch(() => {});
  }

  function openPicker() {
    setShowPicker(true);
    runSearch(productQuery, categoryFilter);
  }

  function onQueryChange(v: string) {
    setProductQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(v, categoryFilter), 300);
  }

  function onCategoryChange(v: string) {
    setCategoryFilter(v);
    runSearch(productQuery, v);
  }

  function selectProduct(p: AdminProductListItem) {
    setProductId(p.product_id);
    setProductName(p.product_name);
    setProductQuery('');
    setShowPicker(false);
  }

  async function trigger() {
    if (!customerId.trim() || !productId.trim()) {
      setStatus({ kind: 'err', text: 'Nhập customer_id và chọn sản phẩm.' });
      return;
    }
    setStatus({ kind: 'busy', text: 'Đang kích hoạt…' });
    try {
      const res = await triggerDemoAlert(customerId.trim(), productId.trim(), alertType, content.trim());
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
        <h2 className="text-lg font-bold text-slate-800">Khuyến mãi</h2>
      </div>

      <div className="relative" ref={pickerRef}>
        <label className="block text-sm font-medium text-slate-700 mb-1">Sản phẩm áp dụng</label>
        <button
          type="button"
          onClick={() => (showPicker ? setShowPicker(false) : openPicker())}
          className="w-full p-2 border border-slate-300 rounded-lg text-sm text-left bg-white hover:border-slate-400"
        >
          {productName ? (
            <span className="text-slate-800">{productName}</span>
          ) : (
            <span className="text-slate-400">Bấm để chọn sản phẩm…</span>
          )}
        </button>

        {showPicker && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                autoFocus
                value={productQuery}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Tìm theo tên sản phẩm…"
                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
              />
              <select
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm max-w-[40%]"
              >
                <option value="">— Tất cả danh mục —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-64 overflow-auto">
              {!productQuery.trim() && (
                <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-slate-400">
                  Gợi ý sản phẩm
                </div>
              )}
              {productResults.length === 0 && (
                <div className="px-2 py-3 text-sm text-slate-400 text-center">Không tìm thấy sản phẩm.</div>
              )}
              {productResults.map((p) => (
                <button
                  key={p.product_id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-slate-50 flex flex-col"
                >
                  <span className="text-slate-800">{p.product_name}</span>
                  <span className="text-xs text-slate-400">{p.category}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {productId && (
          <div className="mt-2 text-xs text-slate-500">
            Product ID: <span className="font-mono text-slate-700">{productId}</span>
          </div>
        )}
      </div>

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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung chương trình</label>
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="VD: Giảm ngay 20% cho đơn hàng cuối tuần này…"
          className="w-full p-2 border border-slate-300 rounded-lg text-sm"
        />
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
