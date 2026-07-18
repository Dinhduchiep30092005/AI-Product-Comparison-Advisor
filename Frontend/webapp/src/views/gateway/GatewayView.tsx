import { useState } from 'react';
import { Bot, Shield, Eye, EyeOff, User, Lock, ArrowRight, Zap } from 'lucide-react';
import { login } from '../../lib/adminApi';

export function GatewayView({
  onEnterChat,
  onAdminLoggedIn,
}: {
  onEnterChat: () => void;
  onAdminLoggedIn: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoggingIn(true);
    try {
      await login(username, password);
      onAdminLoggedIn();
    } catch {
      setError('Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#0056a3] to-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="text-center mb-4 max-w-3xl mx-auto flex flex-col items-center shrink-0">
        {/* Logo — theo giao diện Admin (yellow box + Zap) thay cho logo "Đ" cũ */}
        <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl mb-3 shadow-lg border border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ffdd00] rounded-lg flex items-center justify-center text-[#0056a3]">
              <Zap size={18} fill="currentColor" />
            </div>
            <span className="text-xl font-black text-white tracking-tight uppercase">SmartBot AI</span>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">
          CHÀO MỪNG ĐẾN VỚI HỆ SINH THÁI TRỢ LÝ AI BÁN HÀNG SMARTBOT
        </h1>
        <p className="text-sm text-blue-100 font-medium max-w-2xl">
          Vui lòng lựa chọn cổng truy cập phù hợp với vai trò của bạn để bắt đầu.
        </p>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch min-h-0">
        {/* Customer Card */}
        <div className="group relative bg-white rounded-2xl p-5 shadow-2xl shadow-black/20 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-3xl hover:shadow-[#ffdd00]/20 border-2 border-transparent hover:border-[#ffdd00]">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 text-[#0056a3] group-hover:bg-[#ffdd00]/20 group-hover:scale-110 transition-all duration-300">
            <Bot size={24} strokeWidth={1.5} />
          </div>

          <h2 className="text-lg font-bold text-slate-900 mb-2">Dành cho Khách hàng trải nghiệm</h2>

          <p className="text-slate-600 mb-4 flex-grow leading-relaxed text-sm">
            Trợ lý ảo SmartBot hỗ trợ tìm kiếm sản phẩm, so sánh thông số, tính toán trả góp và tra cứu bảo
            hành 24/7. Hoàn toàn miễn phí, không cần đăng nhập.
          </p>

          <button
            onClick={onEnterChat}
            className="w-full bg-[#ffdd00] hover:bg-[#ffea4d] text-slate-900 font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-[#ffdd00]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>VÀO TRÒ CHUYỆN VỚI SMARTBOT</span>
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Admin Card */}
        <div className="bg-white rounded-2xl p-5 shadow-2xl shadow-black/20 flex flex-col relative overflow-hidden border-2 border-transparent">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -z-10"></div>

          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3 text-[#0056a3]">
            <Shield size={24} strokeWidth={1.5} />
          </div>

          <h2 className="text-lg font-bold text-slate-900 mb-1">Quản trị viên &amp; Cán bộ Nhân viên</h2>

          <p className="text-slate-500 mb-3 text-xs">
            Cổng thông tin quản lý hệ thống dữ liệu, giám sát hội thoại và cấu hình AI. Yêu cầu tài khoản nội
            bộ.
          </p>

          <form className="flex flex-col gap-2.5" onSubmit={handleLogin}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User size={16} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Mã nhân viên / Email nội bộ"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0056a3] focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu hệ thống"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0056a3] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && <div className="text-xs text-red-600 -mt-1">{error}</div>}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-[#0056a3] hover:bg-[#004785] text-white font-bold text-sm py-3 px-4 rounded-lg shadow-lg shadow-[#0056a3]/30 transition-all active:scale-[0.98] mt-auto disabled:opacity-60"
            >
              {loggingIn ? 'Đang đăng nhập…' : 'ĐĂNG NHẬP HỆ THỐNG'}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 text-blue-200/60 text-xs text-center shrink-0">
        <p>© 2026 SmartBot AI. Hệ thống được bảo mật theo tiêu chuẩn nội bộ.</p>
      </div>
    </div>
  );
}
