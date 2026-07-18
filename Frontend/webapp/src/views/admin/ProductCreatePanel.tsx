import { useState } from 'react';
import { createProduct } from '../../lib/adminApi';
import { Modal } from './Modal';

export function ProductCreatePanel({
  categories,
  onClose,
  onCreated,
}: {
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [productName, setProductName] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [warranty, setWarranty] = useState('');
  const [color, setColor] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [features, setFeatures] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'err'; text: string }>({
    kind: 'idle',
    text: '',
  });

  const isNewCategory = categoryLabel === '__new__';
  const effectiveCategory = isNewCategory ? newCategory.trim() : categoryLabel;

  async function save() {
    const num = (v: string) => (v === '' ? null : Number(v));
    const name = productName.trim();
    if (!name) {
      setStatus({ kind: 'err', text: 'Tên sản phẩm không được để trống.' });
      return;
    }
    if (!effectiveCategory) {
      setStatus({ kind: 'err', text: 'Vui lòng chọn hoặc nhập danh mục.' });
      return;
    }
    const original = num(originalPrice);
    const sale = num(salePrice);
    if (original != null && sale != null && sale > original) {
      setStatus({ kind: 'err', text: 'Giá khuyến mãi không được lớn hơn giá gốc.' });
      return;
    }
    setStatus({ kind: 'saving', text: 'Đang tạo…' });
    try {
      await createProduct({
        product_name: name,
        category_label: effectiveCategory,
        brand: brand || null,
        original_price: original,
        sale_price: sale,
        stock_quantity: num(stockQty),
        warranty: warranty || null,
        color: color || null,
        image_url: imageUrl || null,
        product_url: productUrl || null,
        outstanding_features: features || null,
      });
      onCreated();
      onClose();
    } catch (e) {
      setStatus({ kind: 'err', text: (e as Error).message });
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-slate-800">Thêm sản phẩm mới</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">
            Đóng
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Thông tin cơ bản</h4>
            <label className="block text-xs text-slate-500 mb-1">Tên sản phẩm *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Danh mục *</label>
                <select
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">— Chọn danh mục —</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__new__">+ Danh mục mới…</option>
                </select>
                {isNewCategory && (
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Tên danh mục mới"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm mt-2"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Thương hiệu</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

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
              onChange={(e) => setStockQty(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Trạng thái sẽ tự động xác định theo số lượng.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Chi tiết</h4>
            <label className="block text-xs text-slate-500 mb-1">Bảo hành</label>
            <input
              type="text"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
            />
            <label className="block text-xs text-slate-500 mb-1">Màu sắc</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Hình ảnh &amp; liên kết</h4>
            <label className="block text-xs text-slate-500 mb-1">URL hình ảnh</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
            />
            <label className="block text-xs text-slate-500 mb-1">URL sản phẩm</label>
            <input
              type="text"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Tính năng nổi bật</label>
            <textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {status.text && (
          <div className={`text-sm ${status.kind === 'err' ? 'text-red-600' : 'text-slate-500'}`}>
            {status.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={status.kind === 'saving'}
            className="px-6 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover transition-colors disabled:opacity-60"
          >
            Tạo sản phẩm
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </Modal>
  );
}
