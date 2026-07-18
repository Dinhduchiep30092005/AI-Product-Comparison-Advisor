/* UI admin — admin_interface.md MVP */
let token = sessionStorage.getItem("admin_token") || "";
let page = 1;
let editingId = null;
let previewId = null;
let replacesPolicyId = null;

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  opts.headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
  const res = await fetch(path, opts);
  if (res.status === 401) { showLogin(); throw new Error("unauthorized"); }
  if (!res.ok) {
    let msg = "Không thể thực hiện thao tác. Vui lòng kiểm tra lại dữ liệu và thử lại.";
    try { const j = await res.json(); if (j.detail && !/error/i.test(j.detail)) msg = j.detail; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ── Auth ── */
function showLogin() {
  token = ""; sessionStorage.removeItem("admin_token");
  $("login-screen").classList.remove("hidden");
  $("admin-main").classList.add("hidden");
}
async function doLogin() {
  $("login-err").textContent = "";
  try {
    const res = await fetch("/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("login-user").value, password: $("login-pass").value }),
    });
    if (!res.ok) throw new Error();
    token = (await res.json()).token;
    sessionStorage.setItem("admin_token", token);
    enter();
  } catch { $("login-err").textContent = "Sai username hoặc password."; }
}
async function doLogout() {
  try { await api("/admin/logout", { method: "POST" }); } catch {}
  showLogin();
}
async function enter() {
  $("login-screen").classList.add("hidden");
  $("admin-main").classList.remove("hidden");
  loadStats(); loadCategories(); loadProducts(1); loadPolicies();
}

/* ── Dashboard ── */
async function loadStats() {
  try {
    const s = await api("/admin/stats");
    $("stats-row").innerHTML = `
      <div class="stat"><div class="num">${s.total_products.toLocaleString("vi-VN")}</div><div class="lbl">Tổng sản phẩm</div></div>
      <div class="stat"><div class="num">${s.in_stock.toLocaleString("vi-VN")}</div><div class="lbl">Còn hàng</div></div>
      <div class="stat"><div class="num">${s.out_of_stock.toLocaleString("vi-VN")}</div><div class="lbl">Hết hàng</div></div>
      <div class="stat"><div class="num">${s.policy_documents}</div><div class="lbl">Tài liệu chính sách</div></div>`;
  } catch {}
}

/* ── Tabs ── */
function showTab(name) {
  ["products", "policies", "demo"].forEach((t) =>
    $("tab-" + t).classList.toggle("hidden", t !== name));
}

/* ── Sản phẩm ── */
async function loadCategories() {
  try {
    const res = await api("/admin/products/categories");
    $("category-filter").innerHTML = '<option value="">— Tất cả danh mục —</option>'
      + res.categories.map((c) => `<option>${esc(c)}</option>`).join("");
  } catch {}
}
async function loadProducts(p) {
  page = Math.max(1, p);
  $("products-status").textContent = "Đang tải dữ liệu…";
  $("products-table").classList.add("hidden");
  try {
    const params = new URLSearchParams({
      search: $("search-input").value, category: $("category-filter").value, page });
    const res = await api("/admin/products?" + params);
    if (!res.products.length) {
      $("products-status").textContent = "Không có sản phẩm phù hợp.";
      return;
    }
    $("products-status").textContent = "";
    $("products-table").classList.remove("hidden");
    $("page-info").textContent = `Trang ${res.page} — ${res.total.toLocaleString("vi-VN")} sản phẩm`;
    $("products-body").innerHTML = res.products.map((pr) => `
      <tr>
        <td><img src="${esc(pr.image_url || "")}" onerror="this.style.display='none'"></td>
        <td>${esc(pr.product_name)}</td>
        <td>${esc(pr.category)}</td>
        <td>${fmt(pr.original_price)}</td>
        <td>${fmt(pr.sale_price)}</td>
        <td>${pr.stock_quantity ?? "—"}</td>
        <td>${pr.stock_status === "in_stock" ? "Còn hàng" : "Hết hàng"}</td>
        <td>${pr.rating ?? "—"}</td>
        <td><button class="btn" onclick="openEdit('${esc(pr.product_id)}')">Chỉnh sửa</button></td>
      </tr>`).join("");
  } catch (e) {
    $("products-status").textContent = e.message;
  }
}
async function openEdit(id) {
  try {
    const p = await api("/admin/products/" + id);
    editingId = id;
    $("edit-name").textContent = p.product_name;
    $("edit-original").value = p.original_price ?? "";
    $("edit-sale").value = p.sale_price ?? "";
    $("edit-qty").value = p.stock_quantity ?? "";
    $("edit-status").value = p.stock_status || "in_stock";
    $("edit-rating").value = p.rating ?? "";
    $("edit-count").value = p.review_count ?? "";
    $("edit-summary").value = p.review_summary ?? "";
    $("edit-status-msg").textContent = "";
    $("edit-panel").classList.remove("hidden");
    $("edit-panel").scrollIntoView({ behavior: "smooth" });
  } catch (e) { alert(e.message); }
}
async function saveProduct() {
  const msg = $("edit-status-msg");
  msg.className = "status-msg"; msg.textContent = "Đang lưu…";
  const num = (id) => $(id).value === "" ? null : Number($(id).value);
  const body = {
    original_price: num("edit-original"),
    sale_price: num("edit-sale"),
    stock_quantity: num("edit-qty"),
    stock_status: $("edit-status").value,
    review: {
      rating: num("edit-rating"),
      review_count: num("edit-count"),
      summary: $("edit-summary").value || null,
    },
  };
  // Validation phía client (admin_interface.md 4.2)
  if (body.original_price != null && body.sale_price != null
      && body.sale_price > body.original_price) {
    msg.className = "status-msg err";
    msg.textContent = "Giá khuyến mãi không được lớn hơn giá gốc."; return;
  }
  try {
    await api("/admin/products/" + editingId, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    msg.className = "status-msg ok";
    msg.textContent = "Đã cập nhật sản phẩm. Hệ thống AI sẽ sử dụng dữ liệu mới cho các yêu cầu tiếp theo.";
    loadProducts(page); loadStats();
  } catch (e) {
    msg.className = "status-msg err"; msg.textContent = e.message;
  }
}

/* ── Chính sách ── */
async function loadPolicies() {
  try {
    const res = await api("/admin/policies");
    $("policies-body").innerHTML = res.policies.map((p) => `
      <tr><td>${esc(p.title)}</td><td>${esc(p.policy_type)}</td>
      <td>${(p.uploaded_at || "").slice(0, 16).replace("T", " ")}</td>
      <td>${p.chunk_count}</td>
      <td>${p.status === "active" ? "Đang dùng" : "Đã thay thế"}</td></tr>`).join("");
  } catch {}
}
async function uploadPolicy() {
  const msg = $("pol-status");
  msg.className = "status-msg"; msg.textContent = "Đang xử lý…";
  try {
    const file = $("pol-file").files[0];
    const fd = new FormData();
    if (file) fd.append("file", file);
    else if ($("pol-text").value.trim()) fd.append("raw_text", $("pol-text").value.trim());
    else { msg.className = "status-msg err"; msg.textContent = "Chọn file hoặc nhập nội dung."; return; }
    const res = await api("/admin/policies/upload", { method: "POST", body: fd });
    previewId = res.preview_id;
    $("chunk-count").textContent = res.chunks.length;
    $("chunks-list").innerHTML = res.chunks.map((c) =>
      `<div class="chunk"><div class="idx">Chunk #${c.index}</div>${esc(c.text)}</div>`).join("");
    // Hệ thống tự phát hiện trùng policy_type → cảnh báo thay thế
    const chk = await api("/admin/policies/check-replace?policy_type="
      + encodeURIComponent($("pol-type").value));
    replacesPolicyId = chk.will_replace ? chk.replaces_policy_id : null;
    $("replace-warning").classList.toggle("hidden", !chk.will_replace);
    if (chk.will_replace)
      $("replace-warning").textContent =
        `⚠ Tài liệu mới sẽ thay thế "${chk.replaces_title}" hiện tại. Bạn có chắc chắn muốn tiếp tục?`;
    msg.textContent = "";
    $("preview-panel").classList.remove("hidden");
    $("preview-panel").scrollIntoView({ behavior: "smooth" });
  } catch (e) { msg.className = "status-msg err"; msg.textContent = e.message; }
}
async function confirmPolicy() {
  const msg = $("confirm-status");
  msg.className = "status-msg"; msg.textContent = "Đang lưu…";
  try {
    const res = await api("/admin/policies/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preview_id: previewId,
        policy_type: $("pol-type").value,
        title: $("pol-title").value || ($("pol-file").files[0]?.name ?? "Tài liệu mới"),
        replaces_policy_id: replacesPolicyId,   // hệ thống tự điền, admin chỉ xác nhận
      }),
    });
    msg.className = "status-msg ok"; msg.textContent = res.message;
    $("preview-panel").classList.add("hidden");
    loadPolicies(); loadStats();
  } catch (e) { msg.className = "status-msg err"; msg.textContent = e.message; }
}

/* ── Demo ── */
async function triggerDemo() {
  const msg = $("demo-status");
  msg.className = "status-msg"; msg.textContent = "Đang kích hoạt…";
  try {
    const res = await fetch("/demo/trigger-alert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: $("demo-customer").value,
        product_id: $("demo-product").value.trim(),
        alert_type: $("demo-type").value,
      }),
    });
    if (!res.ok) throw new Error("Không kích hoạt được — kiểm tra product_id.");
    const j = await res.json();
    msg.className = "status-msg ok";
    msg.textContent = `Đã kích hoạt sự kiện ${$("demo-type").value}`
      + (j.pushed_via_websocket ? " — đã push qua WebSocket." : " — khách chưa online, alert đã lưu.");
  } catch (e) { msg.className = "status-msg err"; msg.textContent = e.message; }
}

/* ── helpers ── */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(v) { return v == null ? "—" : v.toLocaleString("vi-VN"); }

if (token) enter(); else showLogin();
