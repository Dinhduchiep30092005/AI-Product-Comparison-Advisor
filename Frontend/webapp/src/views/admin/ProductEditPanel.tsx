import { useEffect, useState } from 'react';
import { getProduct, patchProduct } from '../../lib/adminApi';

interface ProductDetail {
  product_name: string;
  category_label?: string;
  brand?: string;
  original_price: number | null;
  sale_price: number | null;
  stock_quantity: number | null;
  stock_status: string;
  rating: number | null;
  review_count: number | null;
  review_summary: string | null;
}

export function ProductEditPanel({
  productId,
  onClose,
  onSaved,
}: {
  productId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [originalPrice, setOriginalPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [stockStatus, setStockStatus] = useState('in_stock');
  const [rating, setRating] = useState('');
  const [reviewCount, setReviewCount] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'ok' | 'err'; text: string }>({
    kind: 'idle',
    text: '',
  });

  useEffect(() => {
    getProduct(productId).then((p) => {
      const pd = p as unknown as ProductDetail;
      setProduct(pd);
      setOriginalPrice(pd.original_price?.toString() ?? '');
      setSalePrice(pd.sale_price?.toString() ?? '');
      setStockQty(pd.stock_quantity?.toString() ?? '');
      setStockStatus(pd.stock_status || 'in_stock');
      setRating(pd.rating?.toString() ?? '');
      setReviewCount(pd.review_count?.toString() ?? '');
      setSummary(pd.review_summary ?? '');
    });
  }, [productId]);

  async function save() {
    const num = (v: string) => (v === '' ? null : Number(v));
    const original = num(originalPrice);
    const sale = num(salePrice);
    if (original != null && sale != null && sale > original) {
      setStatus({ kind: 'err', text: 'Giá khuyến mãi không được lớn hơn giá gốc.' });
      return;
    }
    setStatus({ kind: 'saving', text: 'Đang lưu…' });
    try {
      await patchProduct(productId, {
        original_price: original,
        sale_price: sale,
        stock_quantity: num(stockQty),
        stock_status: stockStatus,
        review: { rating: num(rating), review_count: num(reviewCount), summary: summary || null },
      });
      setStatus({
        kind: 'ok',
        text: 'Đã cập nhật sản phẩm. Hệ thống AI sẽ sử dụng dữ liệu mới cho các yêu cầu tiếp theo.',
      });
      onSaved();
    } catch (e) {
      setStatus({ kind: 'err', text: (e as Error).message });
    }
  }

  if (!product) return <div className="p-6 text-sm text-slate-400">Đang tải dữ liệu…</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-4 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{product.product_name}</h3>
          <p className="text-sm text-slate-500">
            {product.category_label} · {product.brand}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">
          Đóng
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Giá</h4>
          <label className="block text-xs text-slate-500 mb-1">Giá gốc</label>
          <input
            type="number"
            min={0}
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
          />
          <label className="block text-xs text-slate-500 mb-1">Giá khuyến mãi</label>
          <input
            type="number"
            min={0}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Tồn kho</h4>
          <label className="block text-xs text-slate-500 mb-1">Số lượng tồn kho</label>
          <input
            type="number"
            min={0}
            value={stockQty}
            onChange={(e) => {
              setStockQty(e.target.value);
              const n = Number(e.target.value);
              setStockStatus(n > 0 ? 'in_stock' : 'out_of_stock');
            }}
            className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
          />
          <label className="block text-xs text-slate-500 mb-1">Trạng thái</label>
          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="in_stock">Còn hàng</option>
            <option value="out_of_stock">Hết hàng</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Review</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Rating (0-5)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Số lượt đánh giá</label>
              <input
                type="number"
                min={0}
                value={reviewCount}
                onChange={(e) => setReviewCount(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <label className="block text-xs text-slate-500 mb-1">Tóm tắt review</label>
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {status.text && (
        <div className={`text-sm ${status.kind === 'err' ? 'text-red-600' : status.kind === 'ok' ? 'text-green-600' : 'text-slate-500'}`}>
          {status.text}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={status.kind === 'saving'}
          className="px-6 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover transition-colors disabled:opacity-60"
        >
          Lưu thay đổi
        </button>
        <button onClick={onClose} className="px-6 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50">
          Hủy
        </button>
      </div>
    </div>
  );
}
