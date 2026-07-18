export interface SourceCitation {
  tool: string;
  fetched_at?: string | null;
  source_document?: string | null;
}

export interface PriceBlock {
  original_price: number | null;
  sale_price: number | null;
  currency: string;
  source_type: string;
  fetched_at: string | null;
  missing_note?: string;
}

export interface StockBlock {
  status: 'in_stock' | 'out_of_stock' | null;
  stock_quantity: number | null;
  store_id?: string | null;
  source_type: string;
  fetched_at: string | null;
  missing_note?: string;
}

export interface PromotionBlock {
  value: string | null;
  source_type: string;
  fetched_at: string | null;
  missing_note?: string;
}

export interface ReviewBlock {
  rating: number | null;
  review_count: number | null;
  summary: string | null;
  source_type: string;
  fetched_at: string | null;
  missing_note?: string;
}

export interface HighlightedSpec {
  field_name: string;
  label: string;
  value: string;
  source_type: string;
}

export interface Claim {
  field_name: string;
  source_type: 'catalog' | 'realtime' | 'policy';
  value: string;
}

export interface ProductCardData {
  product_id: string;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  price: PriceBlock;
  stock: StockBlock;
  promotion: PromotionBlock;
  review: ReviewBlock;
  highlighted_specs: HighlightedSpec[];
  explanation: string;
  pros: string[];
  cons: string[];
  claims: Claim[];
  over_budget: boolean;
  is_assumed_fields: string[];
  payment_note: string | null;
}

export interface SessionInfo {
  clarify_round?: number;
  slots_collected?: Record<string, unknown>;
}

export type ChatResponse =
  | {
      type: 'CLARIFYING_QUESTION';
      message: string;
      session?: SessionInfo;
    }
  | {
      type: 'PRODUCT_COMPARISON';
      message: string;
      products: ProductCardData[];
      excluded_note: string | null;
      payment_note: string | null;
      session?: SessionInfo;
    }
  | {
      type: 'ANSWER';
      message: string;
      sources?: SourceCitation[];
      session?: SessionInfo;
    };

export interface AlertPayload {
  type: 'ALERT';
  alert_type: 'PRICE_DROP' | 'BACK_IN_STOCK';
  product_name: string;
  message: string;
  new_price?: number;
  old_price?: number;
  source: { system: string; fetched_at: string };
}

export interface NotificationItem extends AlertPayload {
  id: string;
  read: boolean;
}
