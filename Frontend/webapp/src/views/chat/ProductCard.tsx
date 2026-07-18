import { fmtPrice } from '../../lib/format';
import type { ProductCardData } from '../../lib/types';

export function ProductCard({
  product,
  onDetails,
}: {
  product: ProductCardData;
  onDetails: (p: ProductCardData) => void;
}) {
  const { price, stock, promotion, review } = product;

  return (
    <div className="min-w-[220px] w-[220px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0 flex flex-col">
      <img
        src={product.image_url || ''}
        alt={product.product_name}
        className="w-full h-28 object-contain bg-white p-2"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className="p-3 flex flex-col flex-1">
        <h4 className="text-xs font-medium text-gray-800 line-clamp-2 h-8">{product.product_name}</h4>
        <div className="text-[11px] text-gray-500">{product.brand}</div>

        <div className="mt-1.5">
          {price.missing_note ? (
            <span className="text-[11px] text-gray-400 italic">{price.missing_note}</span>
          ) : (
            <>
              <span className="text-[#0056a3] font-bold text-sm">{fmtPrice(price.sale_price)}</span>
              {price.original_price != null && price.original_price !== price.sale_price && (
                <span className="text-gray-400 line-through text-[10px] ml-1">
                  {fmtPrice(price.original_price)}
                </span>
              )}
            </>
          )}
        </div>
        {product.over_budget && (
          <div className="text-[10px] text-amber-600 mt-0.5">⚠ Hơi vượt ngân sách</div>
        )}

        <div className="text-[11px] mt-1">
          {stock.missing_note ? (
            <span className="text-gray-400 italic">{stock.missing_note}</span>
          ) : stock.status === 'in_stock' ? (
            <span className="text-green-600">
              ✔ Còn hàng{stock.stock_quantity != null ? ` (${stock.stock_quantity})` : ''}
            </span>
          ) : (
            <span className="text-red-500">✖ Hết hàng</span>
          )}
        </div>

        <div className="text-[11px] mt-1 text-gray-600">
          {promotion.value ? (
            <span>🎁 {promotion.value}</span>
          ) : (
            <span className="text-gray-400 italic">
              {promotion.missing_note || 'Không tìm thấy thông tin về chương trình khuyến mãi.'}
            </span>
          )}
        </div>

        <div className="text-[11px] mt-1 text-gray-600">
          {review.rating != null ? (
            <span>
              ★ {review.rating}
              {review.review_count ? ` (${review.review_count} lượt)` : ''}
            </span>
          ) : (
            <span className="text-gray-400 italic">{review.missing_note || 'Chưa có dữ liệu đánh giá.'}</span>
          )}
        </div>

        <button
          onClick={() => onDetails(product)}
          className="mt-auto pt-2 w-full bg-[#0056a3] text-white text-xs py-1.5 rounded hover:bg-blue-800 transition-colors"
        >
          Chi tiết
        </button>
      </div>
    </div>
  );
}
