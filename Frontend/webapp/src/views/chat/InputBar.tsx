import { useState } from 'react';

const IconSend = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export function InputBar({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [input, setInput] = useState('');

  const submit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="p-4 bg-white border-t shrink-0">
      <div className="max-w-4xl mx-auto flex gap-2">
        <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 border border-transparent focus-within:border-[#0056a3] focus-within:bg-white transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Nhập nhu cầu của bạn, ví dụ: máy lạnh dưới 20 triệu cho phòng 18m²"
            className="w-full bg-transparent border-none outline-none text-sm py-3"
          />
        </div>
        <button
          onClick={submit}
          disabled={!input.trim() || disabled}
          className={`p-3 rounded-full flex items-center justify-center transition-colors ${
            input.trim() && !disabled ? 'bg-[#0056a3] text-white hover:bg-blue-800' : 'bg-gray-200 text-gray-400'
          }`}
        >
          <IconSend />
        </button>
      </div>
    </div>
  );
}
