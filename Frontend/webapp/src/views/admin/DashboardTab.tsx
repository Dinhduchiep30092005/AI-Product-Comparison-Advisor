import { useEffect, useState } from 'react';
import { PackageCheck, PackageX, FileText } from 'lucide-react';
import { getStats, type AdminStats } from '../../lib/adminApi';
import { fmtTime } from '../../lib/format';

export function DashboardTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setError('Không tải được số liệu thống kê.'));
  }, []);

  const tiles = stats
    ? [
        { label: 'Tổng sản phẩm', value: stats.total_products, icon: PackageCheck },
        { label: 'Còn hàng', value: stats.in_stock, icon: PackageCheck },
        { label: 'Hết hàng', value: stats.out_of_stock, icon: PackageX },
        { label: 'Tài liệu chính sách', value: stats.policy_documents, icon: FileText },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {error && <div className="col-span-full text-sm text-red-600">{error}</div>}
        {!error &&
          tiles.map((t) => (
            <div key={t.label} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">{t.label}</h3>
                <t.icon className="text-dmx-blue w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{t.value.toLocaleString('vi-VN')}</div>
            </div>
          ))}
        {!stats && !error && (
          <div className="col-span-full text-sm text-slate-400">Đang tải dữ liệu…</div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 px-6 py-4 border-b border-slate-200">
          Sản phẩm mới cập nhật
        </h3>
        {stats && stats.recent_products.length === 0 && (
          <div className="text-sm text-slate-400 px-6 py-8 text-center">Chưa có sản phẩm nào.</div>
        )}
        {stats && stats.recent_products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Ảnh</th>
                  <th className="px-4 py-3">Tên sản phẩm</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Giá KM</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Cập nhật lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.recent_products.map((p) => (
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
                    <td className="px-4 py-3">
                      {(p.sale_price ?? p.original_price)?.toLocaleString('vi-VN') ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p.stock_status === 'in_stock' ? 'Còn hàng' : 'Hết hàng'}
                    </td>
                    <td className="px-4 py-3">{fmtTime(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
