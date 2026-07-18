let token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';

export class AuthError extends Error {}

// Không có router/context — AdminShell đăng ký callback này để tự bounce về
// gateway ngay khi BẤT KỲ lệnh gọi admin API nào (ở bất kỳ tab con nào) gặp
// 401, thay vì mỗi tab phải tự phân biệt AuthError với lỗi thường.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function setToken(t: string) {
  token = t;
  sessionStorage.setItem('admin_token', t);
}

export function clearToken() {
  token = '';
  sessionStorage.removeItem('admin_token');
}

export function hasToken(): boolean {
  return !!token;
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
    throw new AuthError('Chưa đăng nhập');
  }
  if (!res.ok) {
    let msg = 'Không thể thực hiện thao tác. Vui lòng kiểm tra lại dữ liệu và thử lại.';
    try {
      const j = await res.json();
      if (j.detail && !/error/i.test(j.detail)) msg = j.detail;
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Sai tên đăng nhập hoặc mật khẩu.');
  const j = await res.json();
  setToken(j.token);
}

export async function logout(): Promise<void> {
  try {
    await api('/admin/logout', { method: 'POST' });
  } catch {
    /* best-effort */
  }
  clearToken();
}

export interface AdminStats {
  total_products: number;
  in_stock: number;
  out_of_stock: number;
  policy_documents: number;
}
export const getStats = () => api<AdminStats>('/admin/stats');

export interface AdminProductListItem {
  product_id: string;
  product_name: string;
  category: string;
  original_price: number | null;
  sale_price: number | null;
  stock_quantity: number | null;
  stock_status: string;
  rating: number | null;
  image_url: string | null;
}
export interface AdminProductList {
  total: number;
  page: number;
  products: AdminProductListItem[];
}
export const listProducts = (search: string, category: string, page: number) =>
  api<AdminProductList>(
    `/admin/products?${new URLSearchParams({ search, category, page: String(page) })}`,
  );

export const listCategories = () => api<{ categories: string[] }>('/admin/products/categories');

export const getProduct = (id: string) => api<Record<string, unknown>>(`/admin/products/${id}`);

export interface ProductPatch {
  original_price?: number | null;
  sale_price?: number | null;
  stock_quantity?: number | null;
  stock_status?: string | null;
  review?: { rating?: number | null; review_count?: number | null; summary?: string | null };
}
export const patchProduct = (id: string, body: ProductPatch) =>
  api(`/admin/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export interface ProductCreate {
  product_name: string;
  category_label: string;
  brand?: string | null;
  original_price?: number | null;
  sale_price?: number | null;
  stock_quantity?: number | null;
  warranty?: string | null;
  color?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  outstanding_features?: string | null;
}
export const createProduct = (body: ProductCreate) =>
  api<{ success: boolean; product_id: string; created_at: string }>('/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export interface Policy {
  id: string;
  title: string;
  policy_type: string;
  status: string;
  uploaded_at: string;
  chunk_count: number;
}
export const listPolicies = () => api<{ policies: Policy[] }>('/admin/policies');

export const deletePolicy = (id: string) =>
  api<{ success: boolean; policy_id: string }>(`/admin/policies/${id}`, { method: 'DELETE' });

export interface PolicyChunk {
  index: number;
  text: string;
}
export const uploadPolicy = (file: File | null, rawText: string) => {
  const fd = new FormData();
  if (file) fd.append('file', file);
  else fd.append('raw_text', rawText);
  return api<{ preview_id: string; chunks: PolicyChunk[] }>('/admin/policies/upload', {
    method: 'POST',
    body: fd,
  });
};

export const checkReplace = (policyType: string) =>
  api<{ will_replace: boolean; replaces_policy_id: string | null; replaces_title?: string }>(
    `/admin/policies/check-replace?policy_type=${encodeURIComponent(policyType)}`,
  );

export const confirmPolicy = (body: {
  preview_id: string;
  policy_type: string;
  title: string;
  replaces_policy_id: string | null;
}) =>
  api<{ success: boolean; policy_id: string; chunks_embedded: number; message: string }>(
    '/admin/policies/confirm',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );

export const triggerDemoAlert = (
  customerId: string,
  productId: string,
  alertType: string,
  message?: string,
) =>
  fetch('/demo/trigger-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: customerId,
      product_id: productId,
      alert_type: alertType,
      message: message || null,
    }),
  }).then(async (res) => {
    if (!res.ok) throw new Error('Không kích hoạt được — kiểm tra product_id.');
    return res.json() as Promise<{ success: boolean; alert_id: string | null; pushed_via_websocket: boolean }>;
  });
