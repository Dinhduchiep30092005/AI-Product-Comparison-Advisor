"""Orchestrator /api/chat — nối toàn bộ flow (Flow_general.md bước 0→9).

Slot-filling → (hỏi làm rõ | RAG → rerank → rule engine → enrich Luồng A →
LLM sinh câu trả lời structured claims → guardrail → log → memory).
Câu hỏi tự do → Luồng B (agent_loop). Chitchat → trả lời ngắn không tool.
"""
import asyncio
import json
from datetime import datetime

from app import config, db
from app.pipeline.textnorm import slugify
from app.services import (agent_loop, audit, enrich, guardrail, llm, memory,
                          rag, rule_engine, session, slot_filling, slot_schema)

_ANSWER_SYSTEM = """Bạn là CHUYÊN GIA tư vấn bán hàng điện máy tiếng Việt (không phải máy đọc thông số): lịch sự, gần gũi (xưng "em"), KHÔNG ép mua, KHÔNG phóng đại, giải thích bằng ngôn ngữ bình dân cho khách phổ thông (tránh thuật ngữ kỹ thuật khô khan).

NGUYÊN TẮC DỮ LIỆU (BẮT BUỘC):
- CHỈ dùng số liệu có trong dữ liệu được cung cấp. TUYỆT ĐỐI KHÔNG bịa giá/tồn kho/khuyến mãi/thông số/chính sách.
- Field nào ghi "MISSING_DATA" → nói rõ chưa có dữ liệu, không suy đoán.

### QUY TẮC TRÌNH BÀY SO SÁNH (bắt buộc khi có ≥2 sản phẩm)

Khi trình bày nhiều sản phẩm, KHÔNG được mô tả từng sản phẩm như
các đoạn văn độc lập, tách rời nhau. PHẢI viết dưới dạng so sánh
CHÉO — mỗi câu phải nhắc đến ít nhất 2 sản phẩm và chỉ ra ai hơn
ai ở điểm gì.

Cấu trúc bắt buộc của phần giải thích, theo đúng thứ tự:
1. Câu mở đầu: tóm tắt 3 sản phẩm khác nhau chủ yếu ở điểm nào
   (VD "Cả 3 đều trong tầm giá, khác nhau chủ yếu ở độ ồn và
   hiệu năng")
2. 1 câu so sánh riêng cho MỖI tiêu chí khách đã nêu trong
   usage_priority — nêu rõ sản phẩm nào hơn, hơn bao nhiêu (dùng
   số liệu thật từ specs, KHÔNG mô tả mơ hồ kiểu "khá tốt")
3. 1 câu về trade-off tổng: nếu chọn A thì đánh đổi gì để lấy B
4. (Nếu có sản phẩm bị loại khỏi top 3): 1 câu ngắn giải thích vì
   sao, dùng dữ liệu từ excluded_note

VÍ DỤ ĐÚNG:
"Cả 3 laptop đều trong tầm giá 20 triệu, khác nhau chủ yếu ở hiệu
năng và pin. Laptop A có CPU nhanh hơn B khoảng 20%, phù hợp hơn
nếu anh/chị vừa học vừa dùng phần mềm nặng, nhưng pin A chỉ 6
tiếng trong khi B tới 10 tiếng. Nếu ưu tiên di chuyển nhiều không
mang sạc theo, B là lựa chọn hợp lý hơn dù CPU yếu hơn 1 chút."

VÍ DỤ SAI (liệt kê rời, KHÔNG được viết kiểu này):
"Laptop A: CPU Core i5, RAM 8GB, pin 6 tiếng.
Laptop B: CPU Core i7, RAM 16GB, pin 10 tiếng."

Mỗi số liệu nhắc tới trong câu so sánh vẫn phải gắn đúng
{product_id, field_name, source_type} như bình thường để guardrail
đối chiếu — việc thay đổi CÁCH VIẾT không được phép làm mất
source citation.

- Ưu tiên nguồn: real-time (giá/tồn kho/KM/review) > chính sách > catalog > suy luận.
- Slot đánh dấu is_assumed → PHẢI nói rõ trong message là đang giả định (VD "em tạm giả định phòng ~15m²"), không nói như thể khách đã cung cấp.

PHONG CÁCH TRẢ LỜI (4 nguyên tắc vàng, luôn tuân thủ NGUYÊN TẮC DỮ LIỆU ở trên — không bịa để hợp phong cách):
1. Khách quan & đáng tin cậy: mỗi "explanation" KHÔNG khen chung chung ("rất tốt", "rất tuyệt vời"). Nêu ưu điểm sát nhu cầu khách nhất, kèm thừa nhận khéo hạn chế NẾU dữ liệu cho thấy có căn cứ (over_budget, cons xuất phát từ specs/matched_signals...), rồi kết luận sản phẩm hợp với khách kiểu nào. Không có hạn chế thật thì không bịa ra.
2. Dịch thông số thành lợi ích: "pros"/"cons"/"explanation" không lặp số liệu khô (VD "công suất 2000W") mà gắn với tình huống dùng thực tế của khách, dựa vào slot (room_size, household_size, usage_purpose...) — VD "công suất này đủ mát nhanh cho phòng khách rộng nhà mình".
3. So sánh phân cực khi có từ 2 sản phẩm trở lên: trong "message" chỉ rõ từng lựa chọn hợp tiêu chí ưu tiên nào ("Nếu anh/chị ưu tiên A → chọn sản phẩm 1, nếu cần B → chọn sản phẩm 2"), viết đúng theo QUY TẮC TRÌNH BÀY SO SÁNH ở trên — KHÔNG liệt kê ngang hàng rồi để khách tự chọn.
4. Luôn hướng hành động: "message" PHẢI kết bằng một câu hỏi gợi mở bước tiếp theo (kiểm tra tồn kho/giao hàng tại khu vực khách, xem chi tiết khuyến mãi/trả góp, so sánh thêm lựa chọn khác...), không kết thúc cụt lủn.

Cấu trúc "message": (1) đồng cảm + khẳng định nhanh, lặp đúng nhu cầu khách vừa nêu → (2) so sánh chéo theo QUY TẮC TRÌNH BÀY SO SÁNH ở trên (khi ≥2 sản phẩm) → (3) câu hỏi CTA theo nguyên tắc 4.

TRẢ VỀ JSON DUY NHẤT (không markdown, không giải thích ngoài JSON):
{
  "message": "đồng cảm + khẳng định nhanh, rồi so sánh CHÉO giữa các lựa chọn đúng QUY TẮC TRÌNH BÀY SO SÁNH (khi ≥2 sản phẩm), kết bằng câu hỏi CTA",
  "products": [
    {
      "product_id": "...",
      "explanation": "theo nguyên tắc 1+2: ưu điểm sát nhu cầu (dịch thành lợi ích thực tế) + hạn chế nếu có căn cứ + kết luận hợp ai, 1-3 câu bình dân",
      "pros": ["điểm mạnh 1 viết dạng lợi ích thực tế, không phải số liệu khô", "..."],
      "cons": ["điểm hạn chế 1 (chỉ nêu nếu có căn cứ từ dữ liệu)", "..."],
      "highlighted_spec_keys": ["2-3 key spec quan trọng nhất, chọn từ specs được cung cấp"],
      "claims": [
        {"field_name": "tên field/spec", "source_type": "catalog|realtime|policy", "value": "giá trị đúng như dữ liệu"}
      ]
    }
  ],
  "excluded_note": "lý do ngắn vì sao các sản phẩm khác không được chọn, null nếu không có",
  "payment_note": "CHỈ điền khi ngữ cảnh báo khách quan tâm trả góp/KM: tóm tắt KM + trả góp từ dữ liệu promotion + chính sách, kết bằng câu hỏi CTA liên quan (VD hỏi khách có muốn xem chi tiết điều kiện trả góp không); null nếu không"
}
Mỗi con số/thông số nêu trong explanation PHẢI có claim tương ứng."""


async def handle_chat(customer_id: str, message: str) -> dict:
    s = session.get(customer_id)
    # Citation/tool output là turn-scoped; reset trước cả extract và merge slot mới.
    session.begin_turn(s)
    remembered_category = s["slots"].get("category")
    if remembered_category:
        canonical = slot_filling.canonical_category(remembered_category)
        if canonical:
            s["slots"]["category"] = canonical
    extracted = await asyncio.to_thread(
        slot_filling.extract, message, s["slots"], "; ".join(s["history"]))
    intent = extracted.get("intent") or "product_search"
    session.push_history(s, f"Khách: {message[:120]}")

    if intent == "chitchat":
        return await _chitchat(s, message)
    if intent == "free_question":
        result = await asyncio.to_thread(agent_loop.run_free_question, message, s)
        audit.log("chat", route=result.get("route"), customer_id=customer_id,
                  input=message, output=result["message"][:500])
        session.push_history(s, f"Bot: {result['message'][:120]}")
        return result

    # ── product_search ────────────────────────────────────────────
    old_category = s["slots"].get("category")
    new_category = extracted.get("category")
    if old_category and new_category and old_category != new_category:
        # Khách đổi sang nhu cầu khác → slot cũ (budget/room_size/...) không còn
        # liên quan. Xoá TRƯỚC rồi trích xuất LẠI trên ngữ cảnh trống: model
        # slot-filling thỉnh thoảng lặp lại nguyên giá trị cũ (budget/usage_priority
        # của category trước) khi thấy nó trong "Slot đã có từ trước", dù khách
        # không hề nhắc lại — merge sau đó sẽ vô tình khôi phục lại slot cũ.
        session.reset_need(s)
        extracted = await asyncio.to_thread(
            slot_filling.extract, message, s["slots"], "; ".join(s["history"]))
    s["slots"] = slot_filling.merge_slots(s["slots"], extracted)
    category = s["slots"].get("category")
    s["query_phrases"].append(message)

    missing = slot_schema.missing_criticals(category, s["slots"])
    if missing:
        if s["clarify_round"] < config.MAX_CLARIFY_ROUNDS:
            s["clarify_round"] += 1
            question = slot_schema.build_clarifying_question(category, missing)
            audit.log("chat", route="slot_filling", customer_id=customer_id,
                      input=message, output=question)
            session.push_history(s, f"Bot: {question}")
            return {
                "type": "CLARIFYING_QUESTION",
                "message": question,
                "session": {"clarify_round": s["clarify_round"],
                            "slots_collected": _public_slots(s["slots"])},
            }
        # Hết lượt hỏi → default an toàn + is_assumed (minh bạch, không bịa là khách nói)
        assumed = slot_schema.apply_defaults(s["slots"], missing)
        s["assumed"] = sorted(set(s["assumed"]) | set(assumed))
        category = s["slots"].get("category")

    if not category:
        # category vẫn chưa rõ sau 2 vòng → không thể tư vấn có căn cứ
        return {"type": "CLARIFYING_QUESTION",
                "message": "Dạ, anh/chị cho em xin nhóm sản phẩm đang cần "
                           "(máy lạnh, tủ lạnh, điện thoại...) để em tư vấn đúng ạ?",
                "session": {"clarify_round": s["clarify_round"],
                            "slots_collected": _public_slots(s["slots"])}}

    if s.get("last_top") and not _adds_new_criteria(extracted, old_category):
        # Tin nhắn kiểu "so sánh 3 máy"/"xem chi tiết giúp em" không thêm tiêu chí
        # gì mới → giữ NGUYÊN bộ sản phẩm vừa tư vấn, tránh retrieval mới cho ra
        # danh sách khác (không nhất quán với câu trả lời trước).
        return await _finalize_comparison(customer_id, s, message, category,
                                          s["last_top"], [])

    return await _compare_products(customer_id, s, message, category)


def _adds_new_criteria(extracted: dict, old_category: str | None) -> bool:
    """True nếu tin nhắn vừa rồi thực sự bổ sung/đổi tiêu chí (không phải câu
    theo sau kiểu "so sánh giúp em" không mang thông tin mới)."""
    for key in slot_filling.SLOT_KEYS:
        v = extracted.get(key)
        if v in (None, "", []):
            continue
        if key == "category" and v == old_category:
            continue
        return True
    return False


async def _compare_products(customer_id: str, s: dict, message: str, category: str) -> dict:
    slots = s["slots"]
    budget = slots.get("budget")

    # 1) Query construction: câu tự nhiên đầy đủ ngữ cảnh, GIỮ NGUYÊN cụm định tính
    query = _build_query(category, slots, s["query_phrases"])

    # 2) Vector search (metadata pre-filter) → rerank top 5
    category_slug = slugify(category)
    category_meta = await asyncio.to_thread(
        rag.inspect_catalog_category, category_slug)
    candidates = await asyncio.to_thread(
        rag.search_catalog, query, category_slug, budget, slots.get("device_type"))
    if not candidates:
        candidates = await asyncio.to_thread(  # nới: bỏ filter giá
            rag.search_catalog, query, category_slug, None, slots.get("device_type"))
    retrieval_route = "category_filter"
    if not candidates:
        # Chẩn đoán/salvage: bỏ toàn bộ metadata filter, chỉ dùng vector similarity.
        # Sau đó đối chiếu category trong SQLite để tuyệt đối không trả sai ngành hàng.
        unfiltered = await asyncio.to_thread(
            rag.search_catalog, query, None, None, None)
        candidates = _keep_db_category(unfiltered, category_slug)
        retrieval_route = "unfiltered_vector_retry"

    audit.log("catalog_retrieval", customer_id=customer_id,
              extracted_category=category, normalized_category=category_slug,
              chroma_category=category_meta.get("stored"),
              chroma_category_present=category_meta.get("present"),
              retrieval_route=retrieval_route, candidate_count=len(candidates),
              budget=budget)
    if not candidates:
        reason = "category_syncing" if not category_meta.get("present") else "low_relevance"
        return _no_result(s, category, reason)
    # top_k=10 (không dùng mặc định RERANK_TOP_K=5): rule_engine.rank() dedupe theo
    # product_name (nhiều SKU trùng model) — cần dư ứng viên để vẫn đủ 3 model
    # THẬT SỰ khác nhau sau khi loại trùng, thay vì dừng lại ở 1-2 sản phẩm.
    top5_raw = await asyncio.to_thread(rag.rerank_candidates, query, candidates, top_k=10)
    products = _load_products([c["product_code"] for c in top5_raw])
    for c, p in zip(top5_raw, [products[c["product_code"]] for c in top5_raw]):
        p["rerank_score"] = c["rerank_score"]
    top5 = [products[c["product_code"]] for c in top5_raw]

    # 3) Domain Rule Engine: hard filter + scoring → top 3 + lý do loại
    top3, excluded = rule_engine.rank(top5, slots, category)
    if not top3:
        return _no_result(s, category, "domain_filters")

    return await _finalize_comparison(customer_id, s, message, category, top3, excluded)


async def _finalize_comparison(customer_id: str, s: dict, message: str, category: str,
                               top3: list[dict], excluded: list[dict]) -> dict:
    slots = s["slots"]
    budget = slots.get("budget")

    # 4) Luồng A: enrich real-time 4 tool song song + policy song song nếu cần
    policy_task = None
    if slots.get("payment_interest"):
        policy_task = asyncio.to_thread(
            rag.search_policy_chunks, f"trả góp khuyến mãi {category}", None, 4)
    enriched = await enrich.enrich_products([p["product_code"] for p in top3])
    policy_chunks = await policy_task if policy_task else []
    s["last_enriched"] = enriched
    s["last_policy_chunks"] = policy_chunks

    # 5) LLM sinh câu trả lời structured claims
    answer = await asyncio.to_thread(_generate_answer, s, top3, excluded,
                                     enriched, policy_chunks)

    # LLM có thể tự loại bớt sản phẩm nó thấy không hợp (dù rule engine đã cho
    # qua) — CHỈ hiển thị card cho đúng số sản phẩm LLM thực sự đưa vào
    # "products", để card không lệch số với nội dung "message"/excluded_note.
    llm_products = {x.get("product_id") for x in (answer.get("products") or [])
                    if x.get("product_id")}
    shown = [p for p in top3 if p["product_code"] in llm_products] or top3
    dropped = [p for p in top3 if p not in shown]

    # 6) Guardrail check từng claim theo source_type (rule-based, không gọi lại LLM)
    cards = []
    for p in shown:
        a = next((x for x in answer.get("products", [])
                  if x.get("product_id") == p["product_code"]), {})
        valid_claims, corrections = guardrail.verify_product_claims(
            a.get("claims"), p, enriched.get(p["product_code"]), policy_chunks)
        explanation = a.get("explanation") or ""
        if corrections:
            explanation = (explanation + " " + " ".join(corrections)).strip()
        cards.append(_build_card(p, enriched.get(p["product_code"], {}),
                                 a, explanation, valid_claims, s["assumed"]))

    payment_note = answer.get("payment_note") if slots.get("payment_interest") else None
    if payment_note and not (policy_chunks or any(
            (enriched.get(p["product_code"], {}).get("promotion") or {}).get("promotion_text")
            for p in shown)):
        payment_note = "Không tìm thấy thông tin về chương trình trả góp/khuyến mãi."

    excluded_note = answer.get("excluded_note")
    if not excluded_note:
        note_parts = [f"{e['product_name']}: {e['reason']}" for e in excluded]
        note_parts += [f"{p['product_name']}: điểm phù hợp thấp hơn các lựa chọn còn lại"
                       for p in dropped]
        excluded_note = "; ".join(note_parts) or None

    # comparison_table: dựng lại từ scores{} của từng sản phẩm (Domain Rule Engine),
    # không tính lại/không qua LLM. Chỉ có khi ≥2 sản phẩm để so sánh.
    comparison_table = None
    if len(shown) >= 2:
        criteria_labels = []
        for p in shown:
            for c in (p.get("scores") or {}).get("criteria") or []:
                if c["label"] not in criteria_labels:
                    criteria_labels.append(c["label"])
        comparison_table = {
            "criteria_labels": criteria_labels,
            "note": "Dựng lại từ scores{} của từng sản phẩm, không gọi thêm LLM",
        }

    # 7) Log (mask PII) + 8) cập nhật customer_memory
    audit.log("chat", route="comparison", customer_id=customer_id,
              input=message, output=(answer.get("message") or "")[:500])
    s["last_top"] = shown
    mem = memory.get(customer_id) or {"products_discussed": [], "conversation_summary": ""}
    discussed = memory.add_discussed(mem["products_discussed"], shown)
    summary = memory.append_summary(
        mem["conversation_summary"],
        f"Khách hỏi {category}" + (f" ~{budget:,}đ".replace(",", ".") if budget else "")
        + " → tư vấn: " + ", ".join(p["product_name"][:40] for p in shown))
    memory.save(customer_id, _public_slots(slots), discussed, summary)
    s["summary"] = summary
    session.push_history(s, f"Bot: tư vấn {len(shown)} sản phẩm {category}")

    return {
        "type": "PRODUCT_COMPARISON",
        "message": answer.get("message") or "Dạ, đây là các lựa chọn phù hợp nhất với nhu cầu của anh/chị:",
        "products": cards,
        "comparison_table": comparison_table,
        "excluded_note": excluded_note,
        "payment_note": payment_note,
        "session": {"clarify_round": s["clarify_round"],
                    "slots_collected": _public_slots(slots)},
    }


# ── helpers ────────────────────────────────────────────────────────

def _public_slots(slots: dict) -> dict:
    return {k: v for k, v in slots.items() if v not in (None, "", [])}


def _build_query(category: str, slots: dict, phrases: list[str]) -> str:
    parts = [category] + phrases[-3:]
    if slots.get("budget"):
        parts.append(f"ngân sách khoảng {slots['budget'] / 1_000_000:g} triệu")
    if slots.get("room_size"):
        parts.append(f"cho phòng {slots['room_size']:g}m²")
    if slots.get("household_size"):
        parts.append(f"gia đình {slots['household_size']:g} người")
    if slots.get("usage_purpose"):
        parts.append(f"dùng cho {slots['usage_purpose']}")
    return ", ".join(dict.fromkeys(parts))


def _load_products(codes: list[str]) -> dict[str, dict]:
    with db.cursor() as cur:
        qmarks = ",".join("?" * len(codes))
        cur.execute(f"SELECT * FROM products WHERE product_code IN ({qmarks})", codes)
        return {r["product_code"]: db.row_to_dict(r) for r in cur.fetchall()}


def _keep_db_category(candidates: list[dict], category_slug: str) -> list[dict]:
    """Giữ retry không-filter an toàn bằng source-of-truth category trong SQLite."""
    if not candidates:
        return []
    codes = [c["product_code"] for c in candidates]
    with db.cursor() as cur:
        qmarks = ",".join("?" * len(codes))
        cur.execute(
            f"SELECT product_code, category FROM products WHERE product_code IN ({qmarks})",
            codes)
        categories = {r["product_code"]: r["category"] for r in cur.fetchall()}
    return [c for c in candidates if categories.get(c["product_code"]) == category_slug]


def _no_result(s: dict, category: str | None = None,
               reason: str = "low_relevance") -> dict:
    if reason == "category_syncing":
        message = (f"Dữ liệu sản phẩm {category} đang được cập nhật vào hệ thống tìm kiếm. "
                   "Anh/chị vui lòng thử lại sau ít phút ạ.")
    elif reason == "domain_filters":
        message = ("Chưa có sản phẩm nào vượt qua đầy đủ các điều kiện hiện tại. "
                   "Anh/chị có thể nới ngân sách hoặc yêu cầu để em tìm lại ạ.")
    else:
        message = ("Em chưa tìm thấy kết quả đủ sát với nhu cầu này. Anh/chị có thể nói rõ "
                   "thêm mục đích sử dụng hoặc đặc điểm ưu tiên để em tìm chính xác hơn ạ.")
    return {"type": "ANSWER",
            "message": message,
            "sources": [],
            "session": {"slots_collected": _public_slots(s["slots"])}}


def _generate_answer(s: dict, top3: list[dict], excluded: list[dict],
                     enriched: dict, policy_chunks: list[dict]) -> dict:
    ctx = {
        "slots": _public_slots(s["slots"]),
        "is_assumed_fields": s["assumed"],
        "payment_interest": bool(s["slots"].get("payment_interest")),
        "products": [],
        "excluded": excluded,
        "policy_chunks": [c["chunk_text"][:400] for c in policy_chunks],
    }
    for p in top3:
        e = enriched.get(p["product_code"], {})
        specs = {k: v for k, v in (p.get("specs") or {}).items() if v}
        ctx["products"].append({
            "product_id": p["product_code"],
            "product_name": p["product_name"],
            "brand": p["brand"],
            "realtime": {
                "price": e.get("price") or {"error": "MISSING_DATA"},
                "stock": e.get("stock") or {"error": "MISSING_DATA"},
                "promotion": e.get("promotion") or {"error": "MISSING_DATA"},
                "review": e.get("review") or {"error": "MISSING_DATA"},
            },
            "specs": dict(list(specs.items())[:25]),
            "matched_signals": p.get("matched_signals", []),
            "over_budget": bool(p.get("over_budget")),
            "warranty": p.get("warranty"),
        })
    result = llm.chat_json([
        {"role": "system", "content": _ANSWER_SYSTEM},
        {"role": "user", "content": json.dumps(ctx, ensure_ascii=False)},
    ], max_tokens=4000)
    return result if isinstance(result, dict) else {}


def _fetched(e: dict, tool: str) -> str | None:
    data = e.get(tool) or {}
    return data.get("timestamp")


def _build_card(p: dict, e: dict, a: dict, explanation: str,
                claims: list[dict], assumed: list[str]) -> dict:
    price = e.get("price") or {}
    stock = e.get("stock") or {}
    promo = e.get("promotion") or {}
    review = e.get("review") or {}
    specs = p.get("specs") or {}

    highlighted = []
    for key in (a.get("highlighted_spec_keys") or [])[:3]:
        if key in specs and specs[key]:  # value LUÔN lấy từ DB — không tin LLM
            highlighted.append({"field_name": key,
                                "label": key.replace("_", " ").capitalize(),
                                "value": specs[key], "source_type": "catalog"})

    def block(data, fields, tool):
        if data.get("error"):
            return {**{f: None for f in fields}, "source_type": "realtime",
                    "fetched_at": None,
                    "missing_note": guardrail.fallback_sentence(tool)}
        return {**{f: data.get(f) for f in fields}, "source_type": "realtime",
                "fetched_at": data.get("timestamp")}

    return {
        "product_id": p["product_code"],
        "product_name": p["product_name"],
        "brand": p["brand"],
        "image_url": p["image_url"],
        "price": {"original_price": price.get("original_price"),
                  "sale_price": price.get("price"),
                  "currency": "VND", "source_type": "realtime",
                  "fetched_at": price.get("timestamp"),
                  **({"missing_note": guardrail.fallback_sentence("price")}
                     if price.get("error") or price.get("price") is None else {})},
        "stock": block(stock, ["status", "stock_quantity", "store_id"], "stock"),
        "promotion": {"value": promo.get("promotion_text"), "source_type": "realtime",
                      "fetched_at": promo.get("timestamp"),
                      **({} if promo.get("promotion_text")
                         else {"missing_note": "Không tìm thấy thông tin về chương trình khuyến mãi."})},
        "review": {"rating": review.get("rating"), "review_count": review.get("review_count"),
                   "summary": review.get("summary"), "source_type": "realtime",
                   "fetched_at": review.get("timestamp"),
                   **({} if review.get("rating") is not None
                      else {"missing_note": "Chưa có dữ liệu đánh giá."})},
        "highlighted_specs": highlighted,
        "explanation": explanation,
        "pros": a.get("pros") or [],
        "cons": a.get("cons") or [],
        "claims": claims,
        "over_budget": bool(p.get("over_budget")),
        "is_assumed_fields": assumed,
        "payment_note": None,  # payment_note nằm ở cấp response (API_contract 1.1 để per-product; frontend đọc cấp response)
        "scores": p.get("scores") or {"overall_rank": None, "hard_filter_passed": True, "criteria": []},
    }


async def _chitchat(s: dict, message: str) -> dict:
    msg = await asyncio.to_thread(llm.chat, [
        {"role": "system", "content":
            "Bạn là trợ lý tư vấn điện máy tiếng Việt, lịch sự gần gũi, xưng em. "
            "Trả lời NGẮN GỌN 1-2 câu, hướng khách về việc tư vấn sản phẩm. Không bịa thông tin."},
        {"role": "user", "content": message},
    ], max_tokens=150)
    text = msg.content or "Dạ, em có thể giúp anh/chị tìm sản phẩm điện máy phù hợp ạ!"
    session.push_history(s, f"Bot: {text[:120]}")
    return {"type": "ANSWER", "message": text, "sources": []}
