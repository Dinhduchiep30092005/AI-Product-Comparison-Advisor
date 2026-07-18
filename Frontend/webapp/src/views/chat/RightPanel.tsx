import { fmtPrice, fmtTime } from '../../lib/format';
import type { ProductCardData } from '../../lib/types';

const IconX = () => (
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
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

function ProductFull({ p }: { p: ProductCardData }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-center bg-white p-4 rounded-xl border">
        <img src={p.image_url || ''} alt={p.product_name} className="h-48 object-contain" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-800">{p.product_name}</h2>
        <div className="text-xs text-gray-500">{p.brand}</div>
        <div className="flex items-end gap-3 mt-2">
          {p.price.missing_note ? (
            <span className="text-sm text-gray-400 italic">{p.price.missing_note}</span>
          ) : (
            <>
              <span className="text-xl font-bold text-[#0056a3]">{fmtPrice(p.price.sale_price)}</span>
              {p.price.original_price != null && p.price.original_price !== p.price.sale_price && (
                <span className="text-gray-500 line-through mb-1">{fmtPrice(p.price.original_price)}</span>
              )}
            </>
          )}
        </div>
      </div>

      {p.promotion.value && (
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
          <h4 className="font-bold text-[#0056a3] mb-2 text-sm">Khuyến mãi</h4>
          <p className="text-sm text-gray-700">🎁 {p.promotion.value}</p>
        </div>
      )}

      {p.highlighted_specs.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-800 mb-2 border-b pb-2 text-sm">Thông số nổi bật</h4>
          <div className="text-sm">
            {p.highlighted_specs.map((s, i) => (
              <div key={s.field_name} className={`flex py-2 px-3 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <span className="w-1/2 text-gray-500">{s.label}</span>
                <span className="w-1/2 font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(p.pros.length > 0 || p.cons.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {p.pros.length > 0 && (
            <div>
              <h4 className="font-bold text-green-700 mb-1">Điểm mạnh</h4>
              <ul className="list-disc pl-4 space-y-1 text-gray-700">
                {p.pros.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {p.cons.length > 0 && (
            <div>
              <h4 className="font-bold text-amber-700 mb-1">Điểm hạn chế</h4>
              <ul className="list-disc pl-4 space-y-1 text-gray-700">
                {p.cons.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {p.explanation && <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4">{p.explanation}</p>}

      <div className="text-[11px] text-gray-400 border-t pt-3 space-y-0.5">
        {p.price.fetched_at && <div>Giá: Product API — {fmtTime(p.price.fetched_at)}</div>}
        {p.stock.fetched_at && <div>Tồn kho: Product API — {fmtTime(p.stock.fetched_at)}</div>}
        {p.review.fetched_at && <div>Review: Product API — {fmtTime(p.review.fetched_at)}</div>}
      </div>

      {p.is_assumed_fields.length > 0 && (
        <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          ℹ️ Một số thông tin đang là giả định: {p.is_assumed_fields.join(', ')}
        </div>
      )}
    </div>
  );
}

export function RightPanel({
  mode,
  product,
  compareList,
  onClose,
}: {
  mode: 'details' | 'compare';
  product: ProductCardData | null;
  compareList: ProductCardData[];
  onClose: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto border-l">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
        <h3 className="font-bold text-gray-800">
          {mode === 'details' ? 'Chi tiết sản phẩm' : 'So sánh các lựa chọn'}
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:bg-gray-200 p-1 rounded">
          <IconX />
        </button>
      </div>

      <div className="p-6">
        {mode === 'details' && product && <ProductFull p={product} />}

        {mode === 'compare' && (
          <div className={`grid gap-4 ${compareList.length > 2 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {compareList.map((p) => (
              <div key={p.product_id} className="border rounded-xl p-4">
                <ProductFull p={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
