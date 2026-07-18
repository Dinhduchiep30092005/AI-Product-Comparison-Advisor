import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fmtTime } from '../../lib/format';
import type { SourceCitation } from '../../lib/types';

const IconBot = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

function citationLine(sources: SourceCitation[]): string {
  return sources
    .map(
      (s) =>
        s.tool +
        (s.fetched_at ? ' — ' + fmtTime(s.fetched_at) : s.source_document ? ' — ' + s.source_document : ''),
    )
    .join(' · ');
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="bg-[#0056a3] text-white px-4 py-2 rounded-2xl rounded-br-sm max-w-[80%] text-sm shadow-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

export function BotBubble({
  text,
  sources,
  assumedFields,
}: {
  text: string;
  sources?: SourceCitation[];
  assumedFields?: string[];
}) {
  return (
    <div className="flex flex-col items-start mb-4 max-w-[90%]">
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-[#0056a3] text-white flex items-center justify-center shrink-0">
          <IconBot />
        </div>
        <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm text-gray-800 text-sm shadow-sm space-y-1 [&_strong]:font-semibold [&_em]:italic [&_em]:text-gray-500 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </div>
      </div>
      {sources && sources.length > 0 && (
        <div className="ml-10 mt-1 text-[11px] text-gray-400">Nguồn: {citationLine(sources)}</div>
      )}
      {assumedFields && assumedFields.length > 0 && (
        <div className="ml-10 mt-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          ℹ️ AI đang tạm giả định một số thông tin ({assumedFields.join(', ')}) vì chưa nhận được câu trả
          lời cụ thể.
        </div>
      )}
    </div>
  );
}

export function ErrorBubble({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start mb-4 max-w-[90%] gap-2">
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
          <IconBot />
        </div>
        <div className="bg-red-50 border border-red-100 px-4 py-3 rounded-2xl rounded-bl-sm text-red-700 text-sm shadow-sm">
          {text}
        </div>
      </div>
      <button
        onClick={onRetry}
        className="ml-10 px-3 py-1.5 rounded-full text-xs font-medium border border-[#0056a3] text-[#0056a3] hover:bg-blue-50"
      >
        Thử lại
      </button>
    </div>
  );
}
