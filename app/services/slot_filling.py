"""Slot-filling (Flow_slot_filling.md): structured extraction bằng DeepSeek-V4-Flash.

Bao gồm Lớp 1b (slang/informal mapping vào usage_priority — LLM tự hiểu, không dùng
dictionary cứng) và 1c (payment/promotion interest detection chung mọi category),
gộp trong CÙNG 1 lệnh gọi LLM (không tốn thêm round).
"""
import time

from app import config, db
from app.pipeline.textnorm import slugify
from app.services import llm

SLOT_KEYS = [
    "category", "budget", "room_size", "sun_exposure", "noise_priority",
    "household_size", "usage_purpose", "usage_priority", "device_type",
    "payment_interest", "brand_preference", "door_type_preference",
    "heater_type_preference", "screen_size_priority", "portability_priority",
    "battery_priority",
]


_categories_cache: tuple[float, list[str], dict[str, str]] | None = None


def _load_categories() -> tuple[list[str], dict[str, str]]:
    """Đọc lại category từ DB — TTL thay vì cache vô thời hạn để chịu được catalog
    re-ingest (thêm/đổi tên category) trong lúc app đang chạy, không cần restart."""
    global _categories_cache
    now = time.monotonic()
    if _categories_cache is None or _categories_cache[0] <= now:
        with db.cursor() as cur:
            cur.execute("SELECT DISTINCT category_label FROM products ORDER BY category_label")
            cats = [r[0] for r in cur.fetchall()]
        lookup = {slugify(label): label for label in cats if label}
        _categories_cache = (now + config.CATEGORY_CACHE_TTL_SECONDS, cats, lookup)
    return _categories_cache[1], _categories_cache[2]


def known_categories() -> list[str]:
    cats, _lookup = _load_categories()
    return cats


def _category_lookup() -> dict[str, str]:
    """Lookup cố định từ dạng chuẩn hoá sang đúng category_label trong catalog."""
    _cats, lookup = _load_categories()
    return lookup


def canonical_category(value) -> str | None:
    """Không cho chuỗi category tự do từ LLM đi thẳng vào metadata filter."""
    if not isinstance(value, str) or not value.strip():
        return None
    return _category_lookup().get(slugify(value))


_SYSTEM_PROMPT_TEMPLATE = """Bạn là bộ trích xuất slot cho trợ lý tư vấn sản phẩm điện máy tiếng Việt.
Nhiệm vụ: đọc tin nhắn khách (có thể KHÔNG DẤU, viết tắt, văn nói, sai chính tả) + slot đã có, trả về JSON DUY NHẤT theo schema bên dưới. KHÔNG suy diễn tự do, KHÔNG thêm field lạ, KHÔNG giải thích.

Schema JSON (field không xác định được thì để null, KHÔNG đoán):
{{
  "intent": "product_search" | "free_question" | "chitchat",
  "category": string|null,       // BẮT BUỘC chọn đúng 1 tên trong danh sách category bên dưới, giữ nguyên chính tả
  "budget": number|null,         // VNĐ, VD "dưới 20 triệu" -> 20000000, "tầm 8tr" -> 8000000
  "room_size": number|null,      // m²
  "sun_exposure": true|false|null,   // phòng có nắng trực tiếp không
  "noise_priority": "quiet"|null,    // khách cần êm/ít ồn
  "household_size": number|null,     // số người dùng
  "usage_purpose": string|null,      // VD "gaming", "văn phòng", "đồ họa", "karaoke", "kinh doanh", "phòng ngủ"
  "usage_priority": string[],        // mảng, map từ ngôn ngữ đời thường:
        // "pin trâu"/"xài cả ngày" -> "battery"; "chụp đẹp"/"sống ảo" -> "camera"
        // "chiến game"/"cấu hình khủng"/"mượt" -> "performance"; "mỏng nhẹ"/"cầm gọn" -> "design"
        // "lưu trữ nhiều" -> "storage"; "tiết kiệm điện" -> "energy_saving"; "trữ đồ nhiều" -> "capacity"
        // "làm lạnh nhanh" -> "cooling_speed"; "hút sạch/mạnh" -> "suction"; "sức khỏe" -> "health_tracking"
        // Cụm mới chưa liệt kê: tự suy luận theo ngữ nghĩa gần nhất với category đang xử lý
  "device_type": string|null,        // loa|tai_nghe (category loa tai nghe); pc_de_ban|man_hinh|may_in|phu_kien_muc_in|may_quet (category pc máy in)
  "payment_interest": true|null,     // CHỈ true nếu khách CHỦ ĐỘNG nhắc trả góp/khuyến mãi/ưu đãi. Không nhắc -> null (KHÔNG đặt false trừ khi khách nói rõ không quan tâm)
  "brand_preference": string|null,
  "door_type_preference": string|null,   // "cửa trên"|"cửa ngang" (máy giặt)
  "heater_type_preference": string|null, // "trực tiếp"|"gián tiếp"|"năng lượng mặt trời"
  "screen_size_priority": number|null,   // inch
  "portability_priority": true|null,
  "battery_priority": true|null,
  "mentioned_product_name": string|null  // khách nhắc đích danh 1 sản phẩm/model cụ thể
}}

intent:
- "product_search": khách mô tả nhu cầu mua/tìm/so sánh sản phẩm (kể cả bổ sung thông tin cho câu hỏi làm rõ trước đó)
- "free_question": câu hỏi tự do về chính sách (bảo hành, đổi trả, giao hàng, trả góp chung) hoặc hỏi thêm về 1 sản phẩm cụ thể ngoài luồng so sánh
- "chitchat": chào hỏi, cảm ơn, ngoài phạm vi mua sắm

Giá trị mới GHI ĐÈ giá trị cũ nếu khách sửa lại (VD "thôi 25 triệu cũng được" -> budget=25000000).
Khách viết không dấu vẫn phải hiểu ("may lanh 2 chieu cho phong 20m2").

Danh sách category hợp lệ:
{categories}
"""


def extract(message: str, session_slots: dict, history_hint: str = "") -> dict:
    """1 lệnh gọi LLM trích toàn bộ slot + intent. Merge để caller tự làm."""
    system = _SYSTEM_PROMPT_TEMPLATE.format(categories=", ".join(known_categories()))
    user = f"Slot đã có từ trước: {session_slots}\n"
    if history_hint:
        user += f"Ngữ cảnh hội thoại gần nhất: {history_hint}\n"
    user += f"Tin nhắn khách: {message}"
    result = llm.chat_json([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    if not isinstance(result, dict):
        return {}
    if result.get("category") is not None:
        # Case/dấu/cách viết được map lại qua taxonomy thật trong SQLite.
        # Giá trị không thuộc taxonomy bị loại, thay vì query Chroma bằng chuỗi tự do.
        result["category"] = canonical_category(result["category"])
    return result


def merge_slots(session_slots: dict, extracted: dict) -> dict:
    """Giá trị mới (không null) ghi đè giá trị cũ."""
    merged = dict(session_slots)
    for key in SLOT_KEYS:
        v = extracted.get(key)
        if v is None or v == "" or v == []:
            continue
        merged[key] = v
    return merged
