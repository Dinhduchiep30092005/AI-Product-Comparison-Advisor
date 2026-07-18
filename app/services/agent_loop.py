"""Luồng B — LLM tool-calling loop cho câu hỏi tự do ngoài top-5 (Flow_agent_loop.md).

PRIMARY: LLM tự chọn trong 5 tool, tối đa 3 vòng, tool read-only auto-exec.
FALLBACK keyword routing: CHỈ khi tool calling thất bại kỹ thuật (provider lỗi,
timeout, tool lạ, args sai schema, không có final answer, vượt 3 vòng).
"""
import json

from app import config
from app.services import llm
from app.tools import registry
from app.tools.specs import TOOL_SPECS

_SYSTEM = """Bạn là CHUYÊN GIA tư vấn sản phẩm điện máy của cửa hàng (không phải máy đọc thông số), nói tiếng Việt lịch sự, gần gũi (xưng "em", gọi khách "anh/chị"), KHÔNG ép mua, KHÔNG phóng đại.

NGUYÊN TẮC BẮT BUỘC:
- Chỉ dùng dữ liệu từ tool trả về hoặc thông tin sản phẩm được cung cấp trong ngữ cảnh. TUYỆT ĐỐI KHÔNG tự bịa giá, tồn kho, khuyến mãi, thông số, chính sách.
- Tool báo lỗi/không có dữ liệu → nói rõ "hiện chưa có dữ liệu", KHÔNG suy đoán.
- Ưu tiên nguồn: dữ liệu real-time từ tool (giá/tồn kho/KM/review) > chính sách > thông tin catalog > suy luận.
- Câu hỏi về sản phẩm cụ thể: dùng product_id trong ngữ cảnh; khách nói "sản phẩm số 2" nghĩa là sản phẩm thứ 2 trong danh sách tư vấn gần nhất.
- Chỉ gọi search_policy khi khách thật sự hỏi một chính sách/quy định cụ thể. Câu hội thoại mơ hồ không phải chính sách: hỏi lại khách cần làm rõ sản phẩm hay chính sách nào, không vector search.

PHONG CÁCH TRẢ LỜI (áp dụng khi phù hợp với câu hỏi, luôn tuân thủ NGUYÊN TẮC BẮT BUỘC ở trên — không bịa để hợp phong cách):
- Khách quan: đừng khen chung chung ("rất tốt"); nếu dữ liệu cho thấy hạn chế thật (giá cao, hết hàng, thiếu tính năng khách hỏi) thì nói thẳng, kèm gợi ý hướng giải quyết.
- Dịch thông số thành lợi ích thực tế theo đúng bối cảnh khách hỏi, không trả lời bằng con số khô khan đơn thuần.
- Nếu khách đang so sánh 2 sản phẩm trở lên: chỉ rõ nên chọn cái nào theo từng ưu tiên cụ thể ("nếu cần X thì chọn A, cần Y thì chọn B"), đừng liệt kê ngang hàng rồi bỏ mặc khách tự quyết.
- Kết câu trả lời bằng một câu hỏi gợi mở bước tiếp theo (kiểm tra tồn kho/giao hàng, xem thêm khuyến mãi, so sánh thêm sản phẩm khác...), trừ khi câu trả lời là hỏi lại khách để làm rõ ý (không cần CTA kép).
- Trả lời ngắn gọn, dễ hiểu với khách phổ thông, giải thích thông số bằng ngôn ngữ bình dân."""


def _dedupe_sources(sources: list[dict]) -> list[dict]:
    """Một tài liệu/tool chỉ hiển thị một lần trong cùng lượt."""
    seen = set()
    out = []
    for source in sources:
        key = (source.get("tool"), source.get("source_document"),
               source.get("product_id"), source.get("fetched_at"))
        if key in seen:
            continue
        seen.add(key)
        out.append(source)
    return out


def _sources_from_result(name: str, args: dict, result: dict) -> list[dict]:
    if name == "search_policy":
        return [{"tool": name, "source_document": chunk.get("source_document")}
                for chunk in (result.get("results") or [])
                if chunk.get("source_document")]
    return [{"tool": name, "product_id": args.get("product_id"),
             "fetched_at": result.get("timestamp")}]


def _context_block(session: dict) -> str:
    lines = []
    if session.get("slots"):
        lines.append(f"Slot khách đã cung cấp: {json.dumps(session['slots'], ensure_ascii=False)}")
    if session.get("last_top"):
        prods = [
            f"  {i+1}. {p['product_name']} (product_id={p['product_code']}, "
            f"giá {p['sale_price'] or p['original_price']}đ)"
            for i, p in enumerate(session["last_top"])
        ]
        lines.append("Sản phẩm đã tư vấn lượt gần nhất:\n" + "\n".join(prods))
    if session.get("summary"):
        lines.append(f"Tóm tắt hội thoại trước: {session['summary']}")
    return "\n".join(lines) or "(chưa có ngữ cảnh trước đó)"


def run_free_question(message: str, session: dict) -> dict:
    """→ {"type": "ANSWER", "message", "sources", "route"}"""
    if config.TOOL_CALLING_ENABLED:
        try:
            return _tool_calling_loop(message, session)
        except Exception as e:  # thất bại kỹ thuật → fallback keyword
            from app.services import audit
            audit.log("tool_calling_fallback", reason=f"{type(e).__name__}: {e}"[:300])
    return _keyword_fallback(message, session)


def _tool_calling_loop(message: str, session: dict) -> dict:
    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": f"NGỮ CẢNH:\n{_context_block(session)}\n\nKhách hỏi: {message}"},
    ]
    sources = []
    for _round in range(config.TOOL_CALL_MAX_ROUNDS):
        msg = llm.chat(messages, tools=TOOL_SPECS)
        if not msg.tool_calls:
            if not msg.content:
                raise RuntimeError("no final answer")
            sources = _dedupe_sources(sources)
            session["citations"] = sources
            return {"type": "ANSWER", "message": msg.content,
                    "sources": sources, "route": "tool_calling"}
        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            name = tc.function.name
            if name not in registry.AUTO_EXECUTABLE:
                raise RuntimeError(f"tool lạ: {name}")  # reject an toàn, không execute
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                raise RuntimeError("args sai schema")
            result = registry.call_tool(name, args)
            session["recent_tool_results"].append({"tool": name, "result": result})
            if not result.get("error"):
                sources.extend(_sources_from_result(name, args, result))
            messages.append({"role": "tool", "tool_call_id": tc.id,
                             "content": json.dumps(result, ensure_ascii=False)})
    raise RuntimeError("vượt số vòng tool call")


# ── FALLBACK keyword routing (có dấu + không dấu) ──────────────────

_KEYWORD_ROUTES = [
    ("promotion", ["khuyến mãi", "khuyen mai", " km", "giảm giá", "giam gia", "ưu đãi",
                   "uu dai", "quà tặng", "qua tang"]),
    ("policy", ["trả góp", "tra gop", "bảo hành", "bao hanh", "đổi trả", "doi tra",
                "giao hàng", "giao hang", "lắp đặt", "lap dat", "chính sách", "chinh sach",
                "điều khoản", "dieu khoan"]),
    ("stock", ["còn hàng", "con hang", "tồn kho", "ton kho", "hết hàng", "het hang",
               "còn không", "con khong"]),
    ("review", ["đánh giá", "danh gia", "review", "nhận xét", "nhan xet"]),
    ("price", ["giá", "gia bao nhiêu", "bao nhiêu tiền", "bao nhieu tien", "gia"]),
]

_ORDINALS = {"1": 0, "nhất": 0, "nhat": 0, "đầu": 0, "dau": 0,
             "2": 1, "hai": 1, "3": 2, "ba": 2}


def _resolve_product(message: str, session: dict) -> dict | None:
    last = session.get("last_top") or []
    if not last:
        return None
    low = message.lower()
    for p in last:
        name_words = (p["product_name"] or "").lower().split()
        if len(name_words) >= 2 and " ".join(name_words[:3]) in low:
            return p
    for token, idx in _ORDINALS.items():
        if (f"số {token}" in low or f"so {token}" in low or f"thứ {token}" in low
                or f"thu {token}" in low) and idx < len(last):
            return last[idx]
    return last[0]


def _keyword_fallback(message: str, session: dict) -> dict:
    low = message.lower()
    route = next((r for r, kws in _KEYWORD_ROUTES if any(k in low for k in kws)), "clarify")
    sources = []

    if route == "clarify":
        return {
            "type": "ANSWER",
            "message": ("Dạ, anh/chị đang muốn hỏi cụ thể về sản phẩm hay chính sách nào ạ? "
                        "Anh/chị nói thêm một chút để em hỗ trợ đúng ý nhé."),
            "sources": [],
            "route": "keyword",
        }

    if route == "policy":
        res = registry.call_tool("search_policy", {"query": message})
        chunks = res.get("results") or []
        if chunks:
            body = "\n\n".join(f"• {c['chunk_text'][:400]}" for c in chunks[:2])
            msg = (f"Dạ, theo chính sách của cửa hàng:\n\n{body}\n\n"
                   "Anh/chị có cần em giải thích rõ thêm phần nào không ạ?")
            sources = _dedupe_sources([
                {"tool": "search_policy", "source_document": c["source_document"]}
                for c in chunks[:2] if c.get("source_document")])
        else:
            msg = ("Dạ, em chưa tìm thấy thông tin chính sách phù hợp với câu hỏi của anh/chị. "
                   "Anh/chị có thể nói rõ hơn mình đang cần chính sách gì để em tra lại không ạ?")
        session["recent_tool_results"].append({"tool": "search_policy", "result": res})
        session["citations"] = sources
        return {"type": "ANSWER", "message": msg, "sources": sources, "route": "keyword"}

    product = _resolve_product(message, session)
    if product is None:
        return {"type": "ANSWER",
                "message": "Dạ, anh/chị cho em biết cụ thể sản phẩm nào để em kiểm tra ạ?",
                "sources": [], "route": "keyword"}
    pid = product["product_code"]
    tool = {"price": "get_product_price", "stock": "get_product_stock",
            "promotion": "get_product_promotion", "review": "get_product_review"}[route]
    res = registry.call_tool(tool, {"product_id": pid})
    name = product["product_name"]
    cta = {"price": "Anh/chị có muốn em kiểm tra thêm khuyến mãi hoặc tồn kho tại chi nhánh gần mình không ạ?",
           "stock": "Anh/chị có cần em xem thêm giá hoặc thời gian giao hàng dự kiến không ạ?",
           "promotion": "Anh/chị có muốn em xem thêm điều kiện áp dụng cụ thể không ạ?",
           "review": "Anh/chị có muốn em so sánh thêm với sản phẩm khác không ạ?"}[route]
    if res.get("error"):
        templates = {"price": "Hiện chưa có dữ liệu giá.",
                     "stock": "Chưa xác định được tồn kho.",
                     "promotion": "Không tìm thấy thông tin về chương trình khuyến mãi.",
                     "review": "Chưa có dữ liệu đánh giá."}
        msg = f"Dạ, với {name}: {templates[route]} Anh/chị có cần em hỗ trợ hỏi thêm về sản phẩm khác không ạ?"
    else:
        sources = [{"tool": tool, "product_id": pid, "fetched_at": res.get("timestamp")}]
        if route == "price":
            msg = (f"Dạ, {name} hiện có giá {res['price']:,}đ"
                   + (f" (giá gốc {res['original_price']:,}đ)"
                      if res.get("original_price") and res["original_price"] != res["price"] else "")
                   ).replace(",", ".") + " ạ."
        elif route == "stock":
            msg = (f"Dạ, {name} hiện {'còn' if res['status'] == 'in_stock' else 'hết'} hàng"
                   + (f" (còn {res['stock_quantity']} chiếc)" if res.get("stock_quantity") else "")
                   + " ạ.")
        elif route == "promotion":
            msg = (f"Dạ, {name} đang có khuyến mãi: {res['promotion_text']} ạ."
                   if res.get("promotion_text")
                   else f"Dạ, {name} hiện chưa có khuyến mãi riêng ạ.")
        else:
            if res.get("rating") is not None:
                msg = f"Dạ, {name} được đánh giá {res['rating']}/5"
                if res.get("review_count"):
                    msg += f" ({res['review_count']} lượt)"
                if res.get("summary"):
                    msg += f". Nhận xét nổi bật: {res['summary']}"
                msg += " ạ."
            else:
                msg = f"Dạ, {name}: Chưa có dữ liệu đánh giá."
        msg = f"{msg} {cta}"
    return {"type": "ANSWER", "message": msg, "sources": sources, "route": "keyword"}
