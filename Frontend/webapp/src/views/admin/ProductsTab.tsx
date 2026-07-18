import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { listCategories, listProducts, type AdminProductListItem } from '../../lib/adminApi';
import { ProductEditPanel } from './ProductEditPanel';
import { ProductCreatePanel } from './ProductCreatePanel';

export function ProductsTab() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<AdminProductListItem[] | null>(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function loadCategories() {
    listCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => {});
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function load(p = page) {
    setProducts(null);
    setError('');
    listProducts(search, category, p)
      .then((r) => {
        setProducts(r.products);
        setTotal(r.total);
        setPage(r.page);
      })
      .catch((e) => setError((e as Error).message));
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Quản lý sản phẩm</h2>
            <p className="text-sm text-slate-500">Cập nhật giá, tồn kho và review</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Thêm sản phẩm
            </button>
            <button
              onClick={() => load(page)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Tải lại
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
            placeholder="Tìm kiếm theo tên sản phẩm…"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dmx-blue/50"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">— Tất cả danh mục —</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => load(1)}
            className="px-4 py-2 bg-dmx-blue text-white rounded-lg text-sm font-medium hover:bg-dmx-blue-hover"
          >
            Tìm
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 bg-slate-50/50 overflow-auto">
        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
        {!error && products === null && <div className="text-sm text-slate-400">Đang tải dữ liệu…</div>}
        {!error && products !== null && products.length === 0 && (
          <div className="text-sm text-slate-400">Không có sản phẩm phù hợp.</div>
        )}
        {!error && products !== null && products.length > 0 && (
          <>
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Ảnh</th>
                    <th className="px-4 py-3">Tên sản phẩm</th>
                    <th className="px-4 py-3">Danh mục</th>
                    <th className="px-4 py-3">Giá gốc</th>
                    <th className="px-4 py-3">Giá KM</th>
                    <th className="px-4 py-3">Tồn kho</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((p) => (
                    <tr key={p.product_id}>
                      <td className="px-4 py-3">
                        <img
                          src={p.image_url || ''}
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">{p.product_name}</td>
                      <td className="px-4 py-3">{p.category}</td>
                      <td className="px-4 py-3">{p.original_price?.toLocaleString('vi-VN') ?? '—'}</td>
                      <td className="px-4 py-3">{p.sale_price?.toLocaleString('vi-VN') ?? '—'}</td>
                      <td className="px-4 py-3">{p.stock_quantity ?? '—'}</td>
                      <td className="px-4 py-3">
                        {p.stock_status === 'in_stock' ? 'Còn hàng' : 'Hết hàng'}
                      </td>
                      <td className="px-4 py-3">{p.rating ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditingId(p.product_id)}
                          className="text-dmx-blue hover:underline font-medium"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
              <span>
                Trang {page} — {total.toLocaleString('vi-VN')} sản phẩm
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => load(page - 1)}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  disabled={page * 20 >= total}
                  onClick={() => load(page + 1)}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          </>
        )}

        {editingId && (
          <ProductEditPanel
            productId={editingId}
            onClose={() => setEditingId(null)}
            onSaved={() => load(page)}
          />
        )}

        {creating && (
          <ProductCreatePanel
            categories={categories}
            onClose={() => setCreating(false)}
            onCreated={() => {
              loadCategories();
              load(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
