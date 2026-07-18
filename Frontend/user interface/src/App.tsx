import React, { useState, useRef, useEffect } from 'react';

// --- Icons ---
const IconBot = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const IconSend = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>;
const IconImage = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconHeadset = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg>;

// --- Mock Data ---
const MOCK_PRODUCTS = [
  { id: 1, name: 'Smart Tivi Samsung 4K 55 inch UA55BU8000', price: '10.990.000₫', oldPrice: '14.900.000₫', img: 'https://cdn.tgdd.vn/Products/Images/1942/272744/samsung-ua55bu8000-1-2.jpg', specs: ['55 inch', '4K (Ultra HD)', 'Tizen OS'] },
  { id: 2, name: 'Smart Tivi Sony 4K 55 inch KD-55X80K', price: '13.490.000₫', oldPrice: '17.900.000₫', img: 'https://cdn.tgdd.vn/Products/Images/1942/273397/sony-kd-55x80k-1.jpg', specs: ['55 inch', '4K (Ultra HD)', 'Google TV'] },
];

// --- Types ---
type Message = {
  id: string;
  type: 'text' | 'products' | 'prompts' | 'system';
  sender: 'bot' | 'user';
  content: string;
  data?: any;
};

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'text',
      sender: 'bot',
      content: 'Chào bạn! Mình là SmartBot của Điện Máy Xanh. Bạn cần hỗ trợ gì hôm nay ạ?'
    },
    {
      id: '2',
      type: 'prompts',
      sender: 'bot',
      content: '',
      data: ['Tìm tivi Samsung', 'Khuyến mãi hôm nay', 'Tra cứu bảo hành']
    }
  ]);
  const [activePanel, setActivePanel] = useState<'none' | 'details' | 'compare' | 'installment'>('none');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activePanel]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = { id: Date.now().toString(), type: 'text', sender: 'user', content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    
    // Mock bot response
    setTimeout(() => {
      if (input.toLowerCase().includes('tivi') || input.toLowerCase().includes('samsung')) {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + 'bot',
          type: 'text',
          sender: 'bot',
          content: 'Dạ, Điện Máy Xanh đang có các mẫu Tivi Samsung bán chạy và nhiều ưu đãi. Mời bạn tham khảo nhé:'
        }, {
          id: Date.now().toString() + 'prod',
          type: 'products',
          sender: 'bot',
          content: '',
          data: MOCK_PRODUCTS
        }]);
      } else if (input.toLowerCase().includes('trả góp')) {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + 'bot',
          type: 'text',
          sender: 'bot',
          content: 'Dạ, bạn muốn tính trả góp cho sản phẩm nào ạ? Bạn có thể mở công cụ tính trả góp ở bên phải.'
        }]);
        setActivePanel('installment');
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + 'bot',
          type: 'text',
          sender: 'bot',
          content: 'Dạ mình ghi nhận thông tin của bạn. Bạn có cần kết nối với nhân viên tư vấn trực tiếp không ạ?'
        }, {
          id: Date.now().toString() + 'prompts2',
          type: 'prompts',
          sender: 'bot',
          content: '',
          data: ['Chuyển giao Nhân viên', 'Tiếp tục chat']
        }]);
      }
    }, 1000);
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => handleSend(), 0); // Quick hack to send immediately
  };

  const handleProductAction = (action: string, product: any) => {
    setSelectedProduct(product);
    setActivePanel(action as any);
  };

  // --- UI Components ---
  const renderMessage = (msg: Message) => {
    if (msg.sender === 'user') {
      return (
        <div key={msg.id} className="flex justify-end mb-4">
          <div className="bg-[#0056a3] text-white px-4 py-2 rounded-2xl rounded-br-sm max-w-[80%] text-sm shadow-sm">
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className="flex flex-col items-start mb-4 max-w-[90%]">
        {msg.type === 'text' && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0056a3] text-white flex items-center justify-center shrink-0">
              <IconBot />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm text-gray-800 text-sm shadow-sm">
              {msg.content}
            </div>
          </div>
        )}

        {msg.type === 'prompts' && (
          <div className="flex flex-wrap gap-2 ml-10 mt-1">
            {msg.data.map((prompt: string, idx: number) => (
              <button
                key={idx}
                onClick={() => handlePromptClick(prompt)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  prompt === 'Chuyển giao Nhân viên' 
                    ? 'border-[#ffdd00] bg-[#ffdd00]/10 text-yellow-700 hover:bg-[#ffdd00]/20' 
                    : 'border-[#0056a3] text-[#0056a3] hover:bg-blue-50'
                }`}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {msg.type === 'products' && (
          <div className="flex gap-3 overflow-x-auto w-full ml-10 mt-2 pb-2 hide-scrollbar">
            {msg.data.map((product: any) => (
              <div key={product.id} className="min-w-[200px] w-[200px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
                <img src={product.img} alt={product.name} className="w-full h-32 object-contain bg-white p-2" />
                <div className="p-3">
                  <h4 className="text-xs font-medium text-gray-800 line-clamp-2 h-8">{product.name}</h4>
                  <div className="mt-2">
                    <span className="text-[#0056a3] font-bold text-sm">{product.price}</span>
                    <span className="text-gray-400 line-through text-[10px] ml-1">{product.oldPrice}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button 
                      onClick={() => handleProductAction('details', product)}
                      className="flex-1 bg-[#0056a3] text-white text-xs py-1.5 rounded hover:bg-blue-800 transition-colors"
                    >
                      Chi tiết
                    </button>
                    <button 
                      onClick={() => handleProductAction('installment', product)}
                      className="flex-1 bg-[#ffdd00] text-gray-800 text-xs font-medium py-1.5 rounded hover:bg-yellow-400 transition-colors"
                    >
                      Trả góp
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const RightPanel = () => {
    if (activePanel === 'none' || !selectedProduct) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <IconBot />
          <p className="mt-4 text-sm">Chọn một tính năng để xem chi tiết</p>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-white overflow-y-auto border-l">
        {/* Panel Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            {activePanel === 'details' && 'Chi tiết sản phẩm'}
            {activePanel === 'compare' && 'So sánh sản phẩm'}
            {activePanel === 'installment' && 'Tính toán trả góp'}
          </h3>
          <button onClick={() => setActivePanel('none')} className="text-gray-500 hover:bg-gray-200 p-1 rounded">
            <IconX />
          </button>
        </div>

        {/* Panel Content */}
        <div className="p-6">
          {activePanel === 'details' && (
            <div className="space-y-6">
              <div className="flex justify-center bg-white p-4 rounded-xl border">
                <img src={selectedProduct.img} alt={selectedProduct.name} className="h-64 object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedProduct.name}</h2>
                <div className="flex items-end gap-3 mt-2">
                  <span className="text-2xl font-bold text-[#0056a3]">{selectedProduct.price}</span>
                  <span className="text-gray-500 line-through mb-1">{selectedProduct.oldPrice}</span>
                </div>
              </div>
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <h4 className="font-bold text-[#0056a3] mb-3">Khuyến mãi đặc biệt</h4>
                <ul className="text-sm space-y-2 text-gray-700">
                  <li className="flex items-start gap-2"><span className="text-green-500">✓</span> Tặng Phiếu mua hàng 500.000đ</li>
                  <li className="flex items-start gap-2"><span className="text-green-500">✓</span> Miễn phí công lắp đặt</li>
                  <li className="flex items-start gap-2"><span className="text-green-500">✓</span> Giảm thêm 3% khi mua kèm Loa soundbar</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Thông số kỹ thuật</h4>
                <div className="text-sm">
                  {selectedProduct.specs.map((spec: string, i: number) => (
                    <div key={i} className={`flex py-2 px-3 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                      <span className="w-1/3 text-gray-500">Thuộc tính {i+1}</span>
                      <span className="w-2/3 font-medium">{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button className="flex-1 bg-[#0056a3] text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition">
                  MUA NGAY
                </button>
                <button onClick={() => setActivePanel('compare')} className="flex-1 border border-[#0056a3] text-[#0056a3] py-3 rounded-lg font-bold hover:bg-blue-50 transition">
                  SO SÁNH
                </button>
              </div>
            </div>
          )}

          {activePanel === 'compare' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {MOCK_PRODUCTS.map(p => (
                  <div key={p.id} className={`p-4 rounded-xl border ${p.id === selectedProduct.id ? 'border-[#0056a3] bg-blue-50/30' : ''}`}>
                    <img src={p.img} alt={p.name} className="h-32 w-full object-contain bg-white mb-3" />
                    <h4 className="text-sm font-medium h-10 line-clamp-2">{p.name}</h4>
                    <p className="font-bold text-[#0056a3] mt-2">{p.price}</p>
                  </div>
                ))}
              </div>
              <div>
                 <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">So sánh thông số</h4>
                 <div className="text-sm border rounded-lg overflow-hidden">
                    <div className="flex border-b bg-gray-50 font-medium">
                      <div className="w-1/3 p-3 border-r">Đặc điểm</div>
                      <div className="w-1/3 p-3 border-r text-center">Tivi Samsung</div>
                      <div className="w-1/3 p-3 text-center">Tivi Sony</div>
                    </div>
                    <div className="flex border-b bg-white">
                      <div className="w-1/3 p-3 border-r text-gray-500">Hệ điều hành</div>
                      <div className="w-1/3 p-3 border-r text-center">Tizen OS</div>
                      <div className="w-1/3 p-3 text-center">Google TV</div>
                    </div>
                    <div className="flex border-b bg-gray-50">
                      <div className="w-1/3 p-3 border-r text-gray-500">Độ phân giải</div>
                      <div className="w-1/3 p-3 border-r text-center">4K</div>
                      <div className="w-1/3 p-3 text-center">4K</div>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activePanel === 'installment' && (
            <div className="space-y-6">
              <div className="flex gap-4 p-4 border rounded-xl items-center">
                 <img src={selectedProduct.img} alt={selectedProduct.name} className="h-16 w-16 object-contain" />
                 <div>
                    <h4 className="font-medium text-sm line-clamp-1">{selectedProduct.name}</h4>
                    <p className="font-bold text-[#0056a3]">{selectedProduct.price}</p>
                 </div>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trả trước (30%)</label>
                  <input type="range" min="0" max="100" defaultValue="30" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0056a3]" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span className="font-bold text-gray-800">3.297.000₫</span>
                    <span>100%</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kỳ hạn vay</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['6 tháng', '9 tháng', '12 tháng'].map((term, i) => (
                      <button key={term} className={`py-2 text-sm rounded border font-medium ${i === 0 ? 'border-[#0056a3] bg-blue-50 text-[#0056a3]' : 'border-gray-200 hover:border-[#0056a3]'}`}>
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Giá sản phẩm</span>
                  <span className="font-medium">{selectedProduct.price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Trả trước</span>
                  <span className="font-medium">3.297.000₫</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gốc + lãi mỗi tháng</span>
                  <span className="font-bold text-[#0056a3] text-lg">1.400.000₫</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Chênh lệch so với mua thẳng</span>
                  <span className="font-medium text-red-500">707.000₫</span>
                </div>
              </div>

              <button className="w-full bg-[#ffdd00] text-gray-800 py-3 rounded-lg font-bold hover:bg-yellow-400 transition shadow-sm">
                ĐẶT MUA TRẢ GÓP
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isSplit = activePanel !== 'none';

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans overflow-hidden">
      
      {/* Background (simulating a website) */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://cdn.tgdd.vn/mwgcart/mwgcore/materials/2024/logo/dienmayxanh-logo.png')] bg-center bg-no-repeat bg-cover"></div>

      {/* Topbar */}
      <div className="h-16 bg-[#0056a3] shrink-0 flex items-center justify-between px-6 text-white shadow-md z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <IconBot />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">SmartBot</h2>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ffdd00]"></span>
              <span className="text-xs text-blue-100">Luôn sẵn sàng hỗ trợ</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center bg-black/10 rounded-full px-3 py-1.5 mr-4 backdrop-blur-sm">
            <IconSearch />
            <input type="text" placeholder="Tìm kiếm nhanh..." className="bg-transparent border-none outline-none text-sm text-white placeholder-blue-200 w-32 ml-2" />
          </div>
        </div>
      </div>

      {/* Top Navigation */}
      <div className="bg-white border-b flex px-6 gap-6 text-sm font-medium text-gray-500 shrink-0 shadow-sm z-10 relative">
        <button className="py-3 border-b-2 border-[#0056a3] text-[#0056a3]">Tư vấn & Hỗ trợ</button>
        <button className="py-3 border-b-2 border-transparent hover:text-gray-800">Đơn hàng của tôi</button>
        <button className="py-3 border-b-2 border-transparent hover:text-gray-800">Chính sách bảo hành</button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Chat Column */}
        <div className={`flex flex-col h-full bg-[#f8fbff] transition-all duration-300 ease-in-out ${isSplit ? 'w-full md:w-2/5' : 'w-full'}`}>
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className={`max-w-4xl mx-auto ${isSplit ? 'w-full' : ''}`}>
              <div className="text-center text-xs text-gray-400 mb-6">Hôm nay, 09:41 AM</div>
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t shrink-0">
            <div className={`max-w-4xl mx-auto flex gap-2 ${isSplit ? 'w-full' : ''}`}>
              <button className="p-3 text-gray-400 hover:text-[#0056a3] hover:bg-blue-50 rounded-full transition">
                <IconImage />
              </button>
              <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 border border-transparent focus-within:border-[#0056a3] focus-within:bg-white transition-all">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Nhập câu hỏi tại đây..." 
                  className="w-full bg-transparent border-none outline-none text-sm py-3"
                />
              </div>
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className={`p-3 rounded-full flex items-center justify-center transition-colors ${
                  input.trim() ? 'bg-[#0056a3] text-white hover:bg-blue-800' : 'bg-gray-200 text-gray-400'
                }`}
              >
                <IconSend />
              </button>
            </div>
            <div className="flex items-center justify-center mt-3 gap-1">
                <button className="flex items-center gap-1.5 text-xs text-[#0056a3] hover:underline font-medium">
                  <IconHeadset /> Kết nối Nhân viên
                </button>
            </div>
          </div>
        </div>

        {/* Dynamic Panel (Right Column) */}
        {isSplit && (
          <div className="hidden md:block w-3/5 bg-gray-50 relative shadow-xl z-10">
            <RightPanel />
          </div>
        )}

      </div>
      
      {/* Some extra global styles for scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
