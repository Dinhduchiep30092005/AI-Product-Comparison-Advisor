import React, { useState } from 'react';
import { Bot, Shield, Eye, EyeOff, User, Lock, ArrowRight } from 'lucide-react';

export default function App() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0056a3] to-slate-900 flex flex-col items-center justify-center p-6 font-sans text-slate-800">
      
      {/* Header Section */}
      <div className="text-center mb-12 max-w-3xl mx-auto flex flex-col items-center">
        {/* Logo Placeholder */}
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl mb-6 shadow-lg border border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#ffdd00] rounded-lg flex items-center justify-center font-bold text-[#0056a3] text-xl">
              Đ
            </div>
            <span className="text-2xl font-black text-white tracking-tight">ĐIỆN MÁY XANH</span>
          </div>
        </div>
        
        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
          CHÀO MỪNG ĐẾN VỚI HỆ SINH THÁI SMARTBOT ĐIỆN MÁY XANH
        </h1>
        <p className="text-lg text-blue-100 font-medium max-w-2xl">
          Vui lòng lựa chọn cổng truy cập phù hợp với vai trò của bạn để bắt đầu.
        </p>
      </div>

      {/* Cards Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Customer Card */}
        <div className="group relative bg-white rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/20 flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-3xl hover:shadow-[#ffdd00]/20 border-2 border-transparent hover:border-[#ffdd00]">
          <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-[#0056a3] group-hover:bg-[#ffdd00]/20 group-hover:scale-110 transition-all duration-300">
            <Bot size={40} strokeWidth={1.5} />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Dành cho Khách hàng trải nghiệm
          </h2>
          
          <p className="text-slate-600 mb-10 flex-grow leading-relaxed">
            Trợ lý ảo thông minh hỗ trợ tìm kiếm sản phẩm, so sánh thông số, tính toán trả góp và tra cứu bảo hành 24/7. Hoàn toàn miễn phí, không cần đăng nhập.
          </p>
          
          <button className="w-full bg-[#ffdd00] hover:bg-[#ffea4d] text-slate-900 font-bold text-lg py-5 px-6 rounded-2xl shadow-lg shadow-[#ffdd00]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
            <span>VÀO TRÒ CHUYỆN VỚI SMARTBOT</span>
            <ArrowRight size={24} />
          </button>
        </div>

        {/* Admin Card */}
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/20 flex flex-col relative overflow-hidden border-2 border-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 text-[#0056a3]">
            <Shield size={40} strokeWidth={1.5} />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Quản trị viên & Cán bộ Nhân viên
          </h2>
          
          <p className="text-slate-500 mb-8 text-sm">
            Cổng thông tin quản lý hệ thống dữ liệu, giám sát hội thoại và cấu hình AI. Yêu cầu tài khoản nội bộ.
          </p>

          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <User size={20} />
              </div>
              <input 
                type="text" 
                placeholder="Mã nhân viên / Email nội bộ" 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056a3] focus:border-transparent transition-all"
              />
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Lock size={20} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Mật khẩu hệ thống" 
                className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056a3] focus:border-transparent transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            <div className="flex justify-end mt-1 mb-2">
              <a href="#" className="text-sm text-[#0056a3] font-medium hover:underline">
                Quên mật khẩu?
              </a>
            </div>

            <button className="w-full bg-[#0056a3] hover:bg-[#004785] text-white font-bold text-lg py-5 px-6 rounded-xl shadow-lg shadow-[#0056a3]/30 transition-all active:scale-[0.98] mt-auto">
              ĐĂNG NHẬP HỆ THỐNG
            </button>
          </form>
        </div>

      </div>
      
      {/* Footer text */}
      <div className="mt-12 text-blue-200/60 text-sm text-center">
        <p>© 2024 Hệ sinh thái AI Điện Máy Xanh. Hệ thống được bảo mật theo tiêu chuẩn nội bộ.</p>
      </div>
      
    </div>
  );
}
