/* UI khách — user_interface.md: landing → chat → product card + citation + toast alert */
let customerId = null;
let ws = null;

const $ = (id) => document.getElementById(id);

function startChat(account) {
  if (account === "new") {
    customerId = "cust_" + crypto.randomUUID().slice(0, 8);
  } else if (account) {
    customerId = account;                       // tài khoản demo cố định
  } else {
    customerId = localStorage.getItem("customer_id")
      || "cust_" + crypto.randomUUID().slice(0, 8);
  }
  localStorage.setItem("customer_id", customerId);
  $("landing").classList.add("hidden");
  $("chat-screen").classList.remove("hidden");
  $("customer-badge").textContent = customerId;
  connectWS();
  const greetings = {
    demo_001: "Chào mừng anh/chị quay lại! Lần trước mình đã tư vấn về máy lạnh. Anh/chị cần xem tiếp hay tìm sản phẩm khác ạ?",
    demo_002: "Chào mừng anh/chị quay lại! Lần trước mình đã tư vấn về tủ lạnh. Anh/chị cần xem tiếp hay tìm sản phẩm khác ạ?",
  };
  addBot(greetings[customerId]
    || "Xin chào! Em là trợ lý tư vấn điện máy. Anh/chị đang cần tìm sản phẩm gì ạ?");
  $("msg-input").addEventListener("input", () => {
    $("send-btn").disabled = !$("msg-input").value.trim();
  });
}

/* ── WebSocket + toast alert ── */
function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws?customer_id=${customerId}`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === "ALERT") showToast(data);
  };
  ws.onclose = () => setTimeout(connectWS, 3000);
}

function showToast(alert) {
  const el = document.createElement("div");
  el.className = "toast";
  const priceInfo = alert.new_price
    ? `<br><b>${fmtPrice(alert.old_price)} → ${fmtPrice(alert.new_price)}</b>` : "";
  el.innerHTML = `🔔 <b>${esc(alert.product_name)}</b><br>${esc(alert.message)}${priceInfo}
    <div style="font-size:11px;color:#93a3bd;margin-top:4px">Nguồn: ${esc(alert.source.system)} — ${fmtTime(alert.source.fetched_at)}</div>`;
  el.onclick = () => {                 // click toast → hỏi lại AI về sản phẩm đó
    $("msg-input").value = `Cho tôi xem lại sản phẩm ${alert.product_name}`;
    $("send-btn").disabled = false;
    sendMessage();
    el.remove();
  };
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 15000);
}

/* ── Gửi tin nhắn ── */
async function sendMessage() {
  const input = $("msg-input");
  const text = input.value.trim();
  if (!text) return;
  addUser(text);
  input.value = "";
  $("send-btn").disabled = true;
  $("typing").classList.remove("hidden");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, message: text }),
    });
    if (!res.ok) throw new Error("http " + res.status);
    render(await res.json());
  } catch {
    addBot("Không thể kết nối đến hệ thống. Vui lòng thử lại.", null, true);
  } finally {
    $("typing").classList.add("hidden");
  }
}

/* ── Render ── */
function render(data) {
  if (data.type === "PRODUCT_COMPARISON") {
    addBot(data.message);
    const wrap = document.createElement("div");
    wrap.className = "msg bot";
    const cards = document.createElement("div");
    cards.className = "cards";
    (data.products || []).forEach((p) => cards.appendChild(card(p)));
    wrap.appendChild(cards);
    if (data.excluded_note) {
      const ex = document.createElement("div");
      ex.className = "excluded-note";
      ex.textContent = "Vì sao không chọn sản phẩm khác: " + data.excluded_note;
      wrap.appendChild(ex);
    }
    if (data.payment_note) {
      const pn = document.createElement("div");
      pn.className = "payment-note";
      pn.textContent = "💳 " + data.payment_note;
      wrap.appendChild(pn);
    }
    const assumed = (data.products?.[0]?.is_assumed_fields) || [];
    if (assumed.length) {
      const an = document.createElement("div");
      an.className = "assumed-note";
      an.textContent = "ℹ️ AI đang tạm giả định một số thông tin (" + assumed.join(", ")
        + ") vì chưa nhận được câu trả lời cụ thể.";
      wrap.appendChild(an);
    }
    $("messages").appendChild(wrap);
  } else {
    // Citation nằm cùng message wrapper để không bị nhìn nhầm là nguồn của lượt sau.
    addBot(data.message, data.sources);
  }
  scrollBottom();
}

function card(p) {
  const el = document.createElement("div");
  el.className = "card";
  const price = p.price || {};
  const stock = p.stock || {};
  const promo = p.promotion || {};
  const review = p.review || {};

  const priceHtml = price.missing_note
    ? `<span class="missing">${esc(price.missing_note)}</span>`
    : `<span class="sale">${fmtPrice(price.sale_price)}</span>`
      + (price.original_price && price.original_price !== price.sale_price
        ? `<span class="orig">${fmtPrice(price.original_price)}</span>` : "");

  const stockHtml = stock.missing_note
    ? `<span class="missing">${esc(stock.missing_note)}</span>`
    : stock.status === "in_stock"
      ? `<span class="stock ok">✔ Còn hàng${stock.stock_quantity != null ? ` (${stock.stock_quantity})` : ""}</span>`
      : `<span class="stock out">✖ Hết hàng</span>`;

  const promoHtml = promo.value
    ? `<div class="promo">🎁 ${esc(promo.value)}</div>`
    : `<div class="missing">${esc(promo.missing_note || "Không tìm thấy thông tin về chương trình khuyến mãi.")}</div>`;

  const reviewHtml = review.rating != null
    ? `<div class="rating">★ ${review.rating}${review.review_count ? ` (${review.review_count} lượt)` : ""}${review.summary ? " — " + esc(review.summary) : ""}</div>`
    : `<div class="missing">${esc(review.missing_note || "Chưa có dữ liệu đánh giá.")}</div>`;

  const specs = (p.highlighted_specs || [])
    .map((s) => `<div class="spec">• ${esc(s.label)}: <b>${esc(s.value)}</b></div>`).join("");

  const pros = (p.pros || []).map((x) => `<li>${esc(x)}</li>`).join("");
  const cons = (p.cons || []).map((x) => `<li>${esc(x)}</li>`).join("");

  const cites = [];
  if (price.fetched_at) cites.push("Giá: Product API — " + fmtTime(price.fetched_at));
  if (stock.fetched_at) cites.push("Tồn kho: Product API — " + fmtTime(stock.fetched_at));
  if (review.fetched_at) cites.push("Review: Product API — " + fmtTime(review.fetched_at));
  if ((p.highlighted_specs || []).length) cites.push("Thông số: Catalog");

  el.innerHTML = `
    <img src="${esc(p.image_url || "")}" onerror="this.style.display='none'" alt="">
    <div class="name">${esc(p.product_name)}</div>
    <div class="brand">${esc(p.brand || "")}</div>
    <div class="price-row">${priceHtml}</div>
    ${p.over_budget ? '<div class="over-budget">⚠ Hơi vượt ngân sách</div>' : ""}
    <div>${stockHtml}</div>
    ${promoHtml}
    ${reviewHtml}
    ${specs}
    ${pros ? `<ul class="pros">${pros}</ul>` : ""}
    ${cons ? `<ul class="cons">${cons}</ul>` : ""}
    ${p.explanation ? `<div class="explain">${esc(p.explanation)}</div>` : ""}
    <div class="sources">Nguồn: ${cites.map(esc).join(" · ") || "—"}</div>`;
  return el;
}

/* ── helpers ── */
function addUser(text) { addMsg(text, "user"); }
function addBot(text, sources, isErr) {
  const el = document.createElement("div");
  el.className = "msg bot";
  el.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  if (sources?.length) {
    const src = document.createElement("div");
    src.className = "sources";
    src.innerHTML = "Nguồn: " + sources
      .map((s) => esc(s.tool + (s.fetched_at
        ? " — " + fmtTime(s.fetched_at)
        : s.source_document ? " — " + s.source_document : "")))
      .join(" · ");
    el.appendChild(src);
  }
  $("messages").appendChild(el);
  scrollBottom();
  if (isErr) {
    const retry = document.createElement("div");
    retry.className = "msg bot";
    retry.innerHTML = `<button class="btn" onclick="this.parentElement.remove()">Thử lại</button>`;
    $("messages").appendChild(retry);
  }
}
function addMsg(text, who) {
  const el = document.createElement("div");
  el.className = "msg " + who;
  el.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  $("messages").appendChild(el);
  scrollBottom();
}
function scrollBottom() { const m = $("messages"); m.scrollTop = m.scrollHeight; }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtPrice(v) {
  return v == null ? "—" : v.toLocaleString("vi-VN") + "đ";
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    + " " + d.toLocaleDateString("vi-VN");
}
