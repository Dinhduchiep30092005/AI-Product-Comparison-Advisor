import { Sparkles } from 'lucide-react';

export function ComingSoonTab({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 py-24">
      <div className="w-16 h-16 rounded-full bg-dmx-blue/10 flex items-center justify-center text-dmx-blue mb-4">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500 mt-2">Sắp ra mắt ở giai đoạn sau.</p>
    </div>
  );
}
