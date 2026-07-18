"""Guardrail check — rule-based, KHÔNG gọi lại LLM (Flow_RAG.md).

Đối chiếu từng claim theo đúng source_type (in-memory, <100ms):
- realtime → dữ liệu Luồng A đã enrich
- catalog  → specs sản phẩm trong top-5 đã retrieve
- policy   → chunk policy đã retrieve
Không khớp / missing_data → thay bằng câu chuẩn theo field_name.
"""
import re
import unicodedata

# Câu chuẩn cố định khi thiếu/sai dữ liệu (Request.md guardrail)
FIELD_FALLBACK = {
    "price": "Hiện chưa có dữ liệu giá.",
    "original_price": "Hiện chưa có dữ liệu giá.",
    "stock": "Chưa xác định được tồn kho.",
    "stock_quantity": "Chưa xác định được tồn kho.",
    "promotion": "Không tìm thấy thông tin về chương trình khuyến mãi.",
    "review": "Chưa có dữ liệu đánh giá.",
    "rating": "Chưa có dữ liệu đánh giá.",
}
DEFAULT_FALLBACK = "Hiện chưa có dữ liệu cho thông tin này."


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFC", str(s)).lower()
    return re.sub(r"\s+", " ", s).strip()


def _nums(s: str) -> set[float]:
    out = set()
    for t in re.findall(r"\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:[.,]\d+)?", str(s)):
        if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", t):
            t = t.replace(".", "")
        else:
            t = t.replace(",", ".")
        try:
            out.add(float(t))
        except ValueError:
            pass
    return out


def _value_matches(claimed, actual) -> bool:
    """So khớp mềm: số phải trùng (bất kỳ số nào của claim có trong actual), text substring."""
    if actual is None:
        return False
    claimed_s, actual_s = _norm(claimed), _norm(actual)
    if claimed_s == actual_s or claimed_s in actual_s or actual_s in claimed_s:
        return True
    c_nums, a_nums = _nums(claimed_s), _nums(actual_s)
    if c_nums:
        return c_nums.issubset(a_nums)
    return False


def check_claim(claim: dict, product: dict | None, enriched: dict | None,
                policy_chunks: list[dict]) -> bool:
    """claim = {product_id, field_name, source_type, value}."""
    source_type = claim.get("source_type")
    field = claim.get("field_name") or ""
    value = claim.get("value")
    if value in (None, ""):
        return False

    if source_type == "realtime":
        if not enriched:
            return False
        for tool in ("price", "stock", "promotion", "review"):
            data = enriched.get(tool) or {}
            if data.get("error"):
                continue
            if field in data:
                return _value_matches(value, data[field])
        # field không nằm trực tiếp → so với toàn bộ dữ liệu realtime
        return any(_value_matches(value, v)
                   for d in enriched.values() if isinstance(d, dict) and not d.get("error")
                   for v in d.values() if v is not None)

    if source_type == "catalog":
        if not product:
            return False
        specs = product.get("specs") or {}
        if field in specs:
            return _value_matches(value, specs[field])
        if field in product:
            return _value_matches(value, product[field])
        # thử khớp key gần đúng
        for k, v in specs.items():
            if field in k or k in field:
                return _value_matches(value, v)
        return False

    if source_type == "policy":
        text = " ".join(c.get("chunk_text", "") for c in policy_chunks)
        return _value_matches(value, text) if text else False

    return False


def fallback_sentence(field_name: str) -> str:
    for key, sentence in FIELD_FALLBACK.items():
        if key in (field_name or ""):
            return sentence
    return DEFAULT_FALLBACK


def verify_product_claims(claims: list[dict], product: dict | None,
                          enriched: dict | None, policy_chunks: list[dict]):
    """→ (claims hợp lệ — giữ + gắn citation, list câu chuẩn thay thế cho claim sai)."""
    valid, corrections = [], []
    for c in claims or []:
        if check_claim(c, product, enriched, policy_chunks):
            valid.append(c)
        else:
            corrections.append(fallback_sentence(c.get("field_name")))
    return valid, sorted(set(corrections))
