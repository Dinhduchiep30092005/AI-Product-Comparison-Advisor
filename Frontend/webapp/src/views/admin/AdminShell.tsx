import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, FileText, Zap, LogOut } from 'lucide-react';
import { logout, setUnauthorizedHandler } from '../../lib/adminApi';
import { DashboardTab } from './DashboardTab';
import { ProductsTab } from './ProductsTab';
import { PoliciesTab } from './PoliciesTab';
import { DemoTab } from './DemoTab';

const TABS = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'products', label: 'Sản phẩm', icon: Package },
  { id: 'policies', label: 'Chính sách', icon: FileText },
  { id: 'demo', label: 'Khuyến mãi', icon: Zap },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminShell({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Token hết hạn ở bất kỳ tab con nào (401) → bounce thẳng về gateway.
  useEffect(() => {
    setUnauthorizedHandler(onLoggedOut);
    return () => setUnauthorizedHandler(null);
  }, [onLoggedOut]);

  async function handleLogout() {
    await logout();
    onLoggedOut();
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      <div className="w-64 bg-dmx-blue text-white flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-dmx-yellow rounded flex items-center justify-center font-bold text-dmx-blue">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-wide uppercase">SmartBot AI</span>
        </div>

        <div className="flex-1 py-6">
          <nav className="space-y-1 px-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                    activeTab === tab.id
                      ? 'bg-white/10 font-medium text-white shadow-sm'
                      : 'text-blue-100/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-dmx-yellow' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 rounded-xl transition-colors text-blue-100/70 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-sm">
          <h1 className="font-semibold text-slate-800">{TABS.find((t) => t.id === activeTab)?.label}</h1>
          <button
            onClick={handleLogout}
            className="md:hidden flex items-center gap-2 text-sm text-slate-600 hover:text-dmx-blue"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-slate-50/50">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'policies' && <PoliciesTab />}
            {activeTab === 'demo' && <DemoTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
