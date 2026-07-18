import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Search, 
  Bell, 
  Globe, 
  MapPin, 
  Upload, 
  Bot, 
  User, 
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Download,
  Filter,
  Sliders,
  Shield,
  Zap,
  ChevronDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

// Mock Data for Charts
const trafficData = [
  { name: '08:00', visitors: 120 },
  { name: '10:00', visitors: 250 },
  { name: '12:00', visitors: 380 },
  { name: '14:00', visitors: 310 },
  { name: '16:00', visitors: 420 },
  { name: '18:00', visitors: 290 },
  { name: '20:00', visitors: 150 },
];

const categoryData = [
  { name: 'Tủ lạnh', value: 400 },
  { name: 'Tivi', value: 300 },
  { name: 'Máy giặt', value: 300 },
  { name: 'Máy lạnh', value: 200 },
  { name: 'Gia dụng', value: 100 },
];

const intentData = [
  { name: 'Hỏi giá/Khuyến mãi', value: 45 },
  { name: 'Tư vấn trả góp', value: 25 },
  { name: 'Chính sách bảo hành', value: 15 },
  { name: 'Giao hàng/Lắp đặt', value: 10 },
  { name: 'Khác', value: 5 },
];

const funnelData = [
  { name: 'Khách Chat', value: 5000 },
  { name: 'AI Tư Vấn', value: 4200 },
  { name: 'Click Link Mua', value: 1500 },
  { name: 'Chốt Đơn', value: 350 },
];

const COLORS = ['#0056a3', '#3b82f6', '#0ea5e9', '#ffdd00', '#f59e0b'];

const DashboardTab = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Tổng số hội thoại</h3>
          <MessageSquare className="text-dmx-blue w-5 h-5" />
        </div>
        <div className="text-2xl font-bold text-slate-800">1,248</div>
        <div className="text-xs text-green-500 flex items-center mt-1">
          <TrendingUp className="w-3 h-3 mr-1" /> +12% so với hôm qua
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Tỷ lệ tự động (Resolution)</h3>
          <Bot className="text-dmx-blue w-5 h-5" />
        </div>
        <div className="text-2xl font-bold text-slate-800">85%</div>
        <div className="text-xs text-green-500 flex items-center mt-1">
          <TrendingUp className="w-3 h-3 mr-1" /> +2% so với tuần trước
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Chỉ số hài lòng (CSAT)</h3>
          <CheckCircle className="text-green-500 w-5 h-5" />
        </div>
        <div className="text-2xl font-bold text-slate-800">4.8/5.0</div>
        <div className="text-xs text-slate-500 mt-1">Dựa trên 850 đánh giá</div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Chuyển giao (Handover)</h3>
          <User className="text-orange-500 w-5 h-5" />
        </div>
        <div className="text-2xl font-bold text-slate-800">15%</div>
        <div className="text-xs text-orange-500 flex items-center mt-1">
          <AlertCircle className="w-3 h-3 mr-1" /> Cần chú ý vào giờ cao điểm
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Lưu lượng truy cập (Hôm nay)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="visitors" stroke="#0056a3" strokeWidth={3} dot={{r: 4, fill: '#0056a3'}} activeDot={{r: 6}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Danh mục quan tâm</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Hot Keywords & Products</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['iPhone 15 Pro Max', 'Máy lạnh Inverter', 'Tủ lạnh 4 cánh', 'Tivi Sony 65 inch'].map((item, i) => (
          <div key={i} className="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-dmx-blue/10 flex items-center justify-center text-dmx-blue font-bold mr-3">
              #{i+1}
            </div>
            <span className="font-medium text-slate-700">{item}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const KnowledgeBaseTab = () => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
    <div className="p-6 border-b border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Trung tâm Dữ liệu & Huấn luyện</h2>
          <p className="text-sm text-slate-500">Quản lý tài liệu, đồng bộ API và cấu hình chiến dịch</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="px-4 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Import Data
          </button>
        </div>
      </div>
      
      <div className="flex mt-6 space-x-1 border-b border-slate-200">
        {['Tệp dữ liệu (PDF/Excel)', 'Đồng bộ hệ thống (API)', 'Bộ câu hỏi FAQ', 'Quản lý Khuyến mãi'].map((tab, idx) => (
          <button 
            key={idx} 
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              idx === 0 
                ? 'border-dmx-blue text-dmx-blue' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>

    <div className="p-6 flex-1 bg-slate-50/50">
      <div className="mb-6 p-4 bg-dmx-blue/5 border border-dmx-blue/20 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dmx-blue/10 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-dmx-blue" />
          </div>
          <div>
            <div className="font-semibold text-slate-800">Tiến trình huấn luyện AI</div>
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <span className="font-medium text-dmx-blue">Nạp dữ liệu</span> → <span>Quét & Phân tích</span> → <span>Thử nghiệm (Sandbox)</span> → <span>Xuất bản</span>
            </div>
          </div>
        </div>
        <button className="px-4 py-2 bg-dmx-yellow text-slate-800 rounded-lg font-medium hover:bg-dmx-yellow-hover text-sm">
          Bắt đầu Huấn luyện
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'thong-so-tu-lanh-samsung-2024.pdf', date: '10/05/2024', size: '2.4 MB', status: 'Đã học' },
          { name: 'bang-gia-tivi-thang-5.xlsx', date: '09/05/2024', size: '1.1 MB', status: 'Đã học' },
          { name: 'danh-sach-sieu-thi-dmx.csv', date: '08/05/2024', size: '500 KB', status: 'Đã học' },
          { name: 'hdsd-may-giat-lg.pdf', date: '07/05/2024', size: '4.2 MB', status: 'Đang xử lý' },
          { name: 'chuong-trinh-km-thang-6.pdf', date: '12/05/2024', size: '1.8 MB', status: 'Chờ xử lý' },
        ].map((file, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-dmx-blue transition-colors cursor-pointer flex flex-col h-full">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-50 text-dmx-blue rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                file.status === 'Đã học' ? 'bg-green-100 text-green-700' : 
                file.status === 'Đang xử lý' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {file.status}
              </span>
            </div>
            <h4 className="font-medium text-slate-800 text-sm truncate mb-1" title={file.name}>{file.name}</h4>
            <div className="text-xs text-slate-400 mt-auto flex justify-between pt-2">
              <span>{file.date}</span>
              <span>{file.size}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const LiveChatTab = () => (
  <div className="h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden">
    {/* Users List */}
    <div className="w-1/4 border-r border-slate-200 flex flex-col bg-slate-50/30">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-3">Phiên chat hiện tại</h3>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm khách hàng..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dmx-blue/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {[
          { name: 'Nguyễn Văn A', status: 'Cần hỗ trợ', msg: 'Tư vấn trả góp phức tạp quá', time: 'Vừa xong', active: true, alert: true },
          { name: 'Trần Thị B', status: 'AI đang chat', msg: 'Cho mình hỏi máy lạnh này...', time: '2p trước', active: false, alert: false },
          { name: 'Khách vãng lai #492', status: 'AI đang chat', msg: 'Có giao hàng hôm nay k?', time: '5p trước', active: false, alert: false },
        ].map((user, i) => (
          <div key={i} className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
            user.active ? 'bg-dmx-blue/5 border-l-4 border-l-dmx-blue' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
          }`}>
            <div className="flex justify-between items-start mb-1">
              <span className="font-medium text-slate-800">{user.name}</span>
              <span className="text-xs text-slate-500">{user.time}</span>
            </div>
            <p className="text-sm text-slate-600 truncate mb-2">{user.msg}</p>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                user.alert ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {user.status}
              </span>
              {user.alert && <AlertCircle className="w-3 h-3 text-red-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Chat Window */}
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
        <div>
          <h3 className="font-semibold text-slate-800">Nguyễn Văn A</h3>
          <p className="text-xs text-slate-500 flex items-center mt-1">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Đang yêu cầu nhân viên
          </p>
        </div>
        <button className="px-4 py-2 bg-dmx-blue text-white rounded-lg text-sm font-medium hover:bg-dmx-blue-hover transition-colors">
          Tiếp quản phiên chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        <div className="flex gap-3 justify-end">
          <div className="bg-dmx-blue text-white p-3 rounded-2xl rounded-tr-sm max-w-[70%] shadow-sm">
            <p className="text-sm">Dạ, Điện Máy Xanh xin chào anh. Em là trợ lý ảo, anh cần hỗ trợ về sản phẩm nào ạ?</p>
            <span className="text-[10px] text-blue-200 mt-1 block text-right">09:12</span>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="bg-white border border-slate-200 text-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[70%] shadow-sm">
            <p className="text-sm">Mình muốn mua iPhone 15 Pro Max, thấy có chương trình trả góp 0%?</p>
            <span className="text-[10px] text-slate-400 mt-1 block">09:13</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <div className="bg-dmx-blue text-white p-3 rounded-2xl rounded-tr-sm max-w-[70%] shadow-sm">
            <p className="text-sm">Dạ đúng rồi anh. Hiện tại iPhone 15 Pro Max đang có chương trình trả góp 0% qua thẻ tín dụng hoặc công ty tài chính. Anh muốn làm hồ sơ qua hình thức nào ạ?</p>
            <span className="text-[10px] text-blue-200 mt-1 block text-right">09:13</span>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="bg-white border border-slate-200 text-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[70%] shadow-sm">
            <p className="text-sm">Tư vấn trả góp phức tạp quá, cho tôi gặp nhân viên đi.</p>
            <span className="text-[10px] text-slate-400 mt-1 block">09:15</span>
          </div>
        </div>
        
        <div className="flex justify-center my-4">
          <span className="text-xs bg-red-100 text-red-600 py-1 px-3 rounded-full border border-red-200 font-medium flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3 h-3" /> AI Handover Trigger: Khách hàng mất kiên nhẫn
          </span>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="mb-3">
          <span className="text-xs font-medium text-slate-500 mb-2 block">AI Co-Pilot Gợi ý (Nhấn để gửi):</span>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button className="whitespace-nowrap px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-dmx-blue border border-blue-200 rounded-full text-xs transition-colors">
              Dạ chào anh, em là nhân viên hỗ trợ, em đang xem thông tin...
            </button>
            <button className="whitespace-nowrap px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-dmx-blue border border-blue-200 rounded-full text-xs transition-colors">
              Gửi form đăng ký trả góp iPhone 15 Pro Max
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            placeholder="Nhập tin nhắn hỗ trợ khách hàng..." 
            className="flex-1 py-2 px-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dmx-blue/50 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            disabled
          />
          <button className="p-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed border border-slate-200">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    {/* Profile */}
    <div className="w-1/4 border-l border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">Hồ sơ khách hàng</h3>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-3 flex items-center justify-center border border-slate-200">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <h4 className="font-bold text-slate-800 text-lg">Nguyễn Văn A</h4>
          <p className="text-sm text-slate-500">0909 xxx 123</p>
        </div>

        <div>
          <h5 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" /> Lịch sử mua hàng
          </h5>
          <div className="space-y-3">
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 text-sm">
              <div className="font-medium text-slate-800">Tủ lạnh Aqua Inverter 189L</div>
              <div className="text-slate-500 text-xs mt-1">Mua ngày: 12/01/2024</div>
              <div className="text-dmx-blue font-semibold mt-1">4.590.000₫</div>
            </div>
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 text-sm">
              <div className="font-medium text-slate-800">Máy xay sinh tố Philips</div>
              <div className="text-slate-500 text-xs mt-1">Mua ngày: 05/11/2023</div>
              <div className="text-dmx-blue font-semibold mt-1">890.000₫</div>
            </div>
          </div>
        </div>

        <div>
          <h5 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-dmx-blue" /> Đang xem / Giỏ hàng
          </h5>
          <div className="border border-dmx-blue/30 bg-blue-50 rounded-lg p-3 text-sm flex gap-3 items-center">
            <div className="w-12 h-12 bg-white rounded-md border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
              <img src="https://images.unsplash.com/photo-1696446701796-da61225697cc?w=100&h=100&fit=crop" alt="iPhone 15" className="object-cover" />
            </div>
            <div>
              <div className="font-medium text-slate-800 line-clamp-2">iPhone 15 Pro Max 256GB</div>
              <div className="text-dmx-blue font-semibold mt-1">29.490.000₫</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AnalyticsTab = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Phân tích & Tối ưu Ý định</h2>
        <p className="text-sm text-slate-500">Đánh giá hiệu suất và độ thông minh của AI</p>
      </div>
      <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
        <Filter className="w-4 h-4" /> Báo cáo Tháng này <ChevronDown className="w-4 h-4" />
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-md font-semibold text-slate-800 mb-4">Bản đồ Ý định (Intent Map)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={intentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12}} />
              <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
              <Bar dataKey="value" fill="#0056a3" radius={[0, 4, 4, 0]}>
                {intentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-md font-semibold text-slate-800 mb-4">Phân tích Phễu (Funnel Conversion)</h3>
        <div className="space-y-4 mt-8">
          {funnelData.map((step, idx) => (
            <div key={idx} className="relative">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">{step.name}</span>
                <span className="font-bold text-slate-900">{step.value.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div 
                  className="bg-dmx-blue h-3 rounded-full" 
                  style={{ width: `${(step.value / funnelData[0].value) * 100}%`, opacity: 1 - (idx * 0.2) }}
                ></div>
              </div>
              {idx < funnelData.length - 1 && (
                <div className="absolute right-0 top-6 text-xs text-green-600 font-medium">
                  {Math.round((funnelData[idx+1].value / step.value) * 100)}% chuyển đổi
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-slate-800">Hộp thư Thất bại (Fallback Logs)</h3>
        <button className="text-dmx-blue text-sm font-medium hover:underline">Xem tất cả</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-medium border-y border-slate-200">
            <tr>
              <th className="px-4 py-3">Câu hỏi của khách</th>
              <th className="px-4 py-3">AI Trả lời</th>
              <th className="px-4 py-3">Hành động cần làm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="px-4 py-3">TV Samsung QA55Q60B mới ra mắt có chưa?</td>
              <td className="px-4 py-3 text-red-500">Không tìm thấy thông tin sản phẩm.</td>
              <td className="px-4 py-3"><button className="text-dmx-blue hover:underline">Bổ sung Data Model Mới</button></td>
            </tr>
            <tr>
              <td className="px-4 py-3">Tôi muốn đổi trả máy giặt sau 2 ngày mua</td>
              <td className="px-4 py-3 text-red-500">Chuyển giao cho nhân viên (Handover).</td>
              <td className="px-4 py-3"><button className="text-dmx-blue hover:underline">Tạo kịch bản Đổi Trả</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const SettingsTab = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:col-span-2">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-4">
        <Sliders className="w-5 h-5 text-dmx-blue" />
        <h2 className="text-lg font-bold text-slate-800">Cấu hình Cá tính (Persona Settings)</h2>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tên Trợ lý AI</label>
          <input type="text" defaultValue="Trợ lý Điện Máy Xanh" className="w-full max-w-md p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dmx-blue focus:border-transparent text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Giọng điệu (Tone of Voice)</label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="border-2 border-dmx-blue bg-blue-50 p-3 rounded-lg cursor-pointer">
              <div className="font-medium text-dmx-blue text-sm">Thân thiện, Lễ phép</div>
              <div className="text-xs text-slate-500 mt-1">Luôn dạ/vâng, gọi Anh/Chị</div>
            </div>
            <div className="border-2 border-slate-200 hover:border-slate-300 p-3 rounded-lg cursor-pointer transition-colors">
              <div className="font-medium text-slate-700 text-sm">Chuyên nghiệp, Nhanh gọn</div>
              <div className="text-xs text-slate-500 mt-1">Tập trung vào thông số</div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prompt Chỉ đạo (System Prompt)</label>
          <textarea 
            rows={4} 
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dmx-blue text-sm"
            defaultValue="Bạn là nhân viên tư vấn của hệ thống Điện Máy Xanh. Luôn chào hỏi khách hàng bằng 'Dạ' và xưng hô 'Anh/Chị'. Cung cấp thông tin chính xác về giá cả và khuyến mãi. Nếu khách bực tức, hãy xin lỗi và đề nghị chuyển cho nhân viên thật."
          ></textarea>
        </div>

        <button className="px-6 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover transition-colors">
          Lưu cấu hình
        </button>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-4">
        <Shield className="w-5 h-5 text-dmx-blue" />
        <h2 className="text-lg font-bold text-slate-800">Phân quyền (Roles)</h2>
      </div>
      
      <div className="space-y-4">
        <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-slate-800">Super Admin</div>
            <div className="text-xs text-slate-500">Toàn quyền hệ thống</div>
          </div>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">3 User</span>
        </div>
        
        <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-slate-800">Content Manager</div>
            <div className="text-xs text-slate-500">Quản lý Data & FAQ</div>
          </div>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">12 User</span>
        </div>
        
        <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-slate-800">Live Agent</div>
            <div className="text-xs text-slate-500">Chỉ xem & Chat</div>
          </div>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">45 User</span>
        </div>

        <button className="w-full py-2 mt-4 border border-dashed border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          + Thêm Role mới
        </button>
      </div>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'knowledge', label: 'Huấn luyện AI', icon: Database },
    { id: 'chat', label: 'Giám sát Chat', icon: MessageSquare },
    { id: 'analytics', label: 'Phân tích', icon: BarChart3 },
    { id: 'settings', label: 'Cấu hình', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-dmx-blue text-white flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-dmx-yellow rounded flex items-center justify-center font-bold text-dmx-blue">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-wide uppercase">SmartBot DMX</span>
        </div>
        
        <div className="flex-1 py-6">
          <nav className="space-y-1 px-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
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
          <div className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center overflow-hidden border border-white/20">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" alt="Admin" />
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium text-white">Admin Vũ</span>
              <span className="text-[10px] text-blue-200">Super Admin</span>
            </div>
            <Settings className="w-4 h-4 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-sm">
          <div className="flex items-center gap-4 w-96">
            <div className="relative w-full hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm khách hàng, sản phẩm, cài đặt..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dmx-blue/50 focus:bg-white transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="font-medium">Toàn quốc</span>
            </div>
            
            <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer font-medium hover:text-dmx-blue transition-colors">
              <Globe className="w-4 h-4" />
              <span>VI</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-slate-50/50">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'knowledge' && <KnowledgeBaseTab />}
            {activeTab === 'chat' && <LiveChatTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
