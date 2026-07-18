import { useEffect, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import {
  checkReplace,
  confirmPolicy,
  listPolicies,
  uploadPolicy,
  type Policy,
  type PolicyChunk,
} from '../../lib/adminApi';
import { config } from '../../lib/config';

export function PoliciesTab() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [title, setTitle] = useState('');
  const [policyType, setPolicyType] = useState(config.policyTypes[0]);
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<PolicyChunk[]>([]);
  const [willReplace, setWillReplace] = useState<{ id: string; title: string } | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; text: string }>({
    kind: 'idle',
    text: '',
  });

  function load() {
    listPolicies()
      .then((r) => setPolicies(r.policies))
      .catch(() => {});
  }
  useEffect(load, []);

  async function doUpload() {
    if (!file && !rawText.trim()) {
      setStatus({ kind: 'err', text: 'Chọn file hoặc nhập nội dung.' });
      return;
    }
    setStatus({ kind: 'busy', text: 'Đang xử lý…' });
    try {
      const res = await uploadPolicy(file, rawText.trim());
      setPreviewId(res.preview_id);
      setChunks(res.chunks);
      const chk = await checkReplace(policyType);
      setWillReplace(chk.will_replace ? { id: chk.replaces_policy_id!, title: chk.replaces_title || '' } : null);
      setStatus({ kind: 'idle', text: '' });
    } catch (e) {
      setStatus({ kind: 'err', text: (e as Error).message });
    }
  }

  async function doConfirm() {
    if (!previewId) return;
    setStatus({ kind: 'busy', text: 'Đang lưu…' });
    try {
      const res = await confirmPolicy({
        preview_id: previewId,
        policy_type: policyType,
        title: title || file?.name || 'Tài liệu mới',
        replaces_policy_id: willReplace?.id ?? null,
      });
      setStatus({ kind: 'ok', text: res.message });
      setPreviewId(null);
      setChunks([]);
      load();
    } catch (e) {
      setStatus({ kind: 'err', text: (e as Error).message });
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Quản lý chính sách</h2>
        <p className="text-sm text-slate-500">Tải lên hoặc nhập nội dung, xem trước chunk trước khi lưu</p>
      </div>

      <div className="p-6 flex-1 bg-slate-50/50 overflow-auto space-y-6">
        {policies === null && <div className="text-sm text-slate-400">Đang tải dữ liệu…</div>}
        {policies && policies.length === 0 && (
          <div className="text-sm text-slate-400">Chưa có tài liệu chính sách nào.</div>
        )}
        {policies && policies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {policies.map((p) => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-50 text-dmx-blue rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.status === 'active' ? 'Đang dùng' : 'Đã thay thế'}
                  </span>
                </div>
                <h4 className="font-medium text-slate-800 text-sm truncate mb-1">{p.title}</h4>
                <div className="text-xs text-slate-400">{p.policy_type}</div>
                <div className="text-xs text-slate-400 mt-auto pt-2 flex justify-between">
                  <span>{(p.uploaded_at || '').slice(0, 16).replace('T', ' ')}</span>
                  <span>{p.chunk_count} chunk</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">Thêm chính sách mới</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tên tài liệu</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Loại chính sách</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              >
                {config.policyTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nội dung (nhập tay)</label>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hoặc chọn file (PDF/DOCX/TXT/MD)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          {status.kind === 'err' && <div className="text-sm text-red-600">{status.text}</div>}
          <button
            onClick={doUpload}
            className="px-4 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" /> Tải lên và xử lý
          </button>
        </div>

        {chunks.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Xem trước ({chunks.length} chunk)</h3>
            {willReplace && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                ⚠ Tài liệu mới sẽ thay thế "{willReplace.title}" hiện tại. Bạn có chắc chắn muốn tiếp tục?
              </div>
            )}
            <div className="max-h-80 overflow-auto space-y-2">
              {chunks.map((c) => (
                <div key={c.index} className="text-sm border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="text-xs font-medium text-slate-400 mb-1">Chunk #{c.index}</div>
                  {c.text}
                </div>
              ))}
            </div>
            {status.kind === 'ok' && <div className="text-sm text-green-600">{status.text}</div>}
            <div className="flex gap-3">
              <button
                onClick={doConfirm}
                disabled={status.kind === 'busy'}
                className="px-6 py-2 bg-dmx-blue text-white rounded-lg font-medium hover:bg-dmx-blue-hover disabled:opacity-60"
              >
                Xác nhận lưu
              </button>
              <button
                onClick={() => {
                  setChunks([]);
                  setPreviewId(null);
                }}
                className="px-6 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
