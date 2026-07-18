import { useEffect, useState } from 'react';
import { MessageSquareText, PackageCheck, PackageX, FileText } from 'lucide-react';
import { getStats, type AdminStats } from '../../lib/adminApi';

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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
        <MessageSquareText className="w-8 h-8 mb-3" />
        <p className="text-sm">Biểu đồ lưu lượng truy cập &amp; danh mục quan tâm — sắp ra mắt ở giai đoạn sau.</p>
      </div>
    </div>
  );
}
