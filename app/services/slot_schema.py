"""Slot schema theo category (Flow_slot_filling.md mục 2) — mapping cố định, không do LLM quyết.

Key = category_label viết thường đúng như dữ liệu (VD "máy lạnh", "pc, máy in").
Category không có trong NHÓM 1 → dùng DEFAULT_SCHEMA (Nhóm 2).
"""

# Câu hỏi làm rõ theo slot — gộp TẤT CẢ slot thiếu vào 1 lượt hỏi duy nhất
SLOT_QUESTIONS = {
    "category": "anh/chị đang muốn mua sản phẩm thuộc nhóm nào (máy lạnh, tủ lạnh, điện thoại, laptop...)",
    "budget": "ngân sách dự kiến tầm bao nhiêu",
    "room_size": "phòng sử dụng khoảng bao nhiêu m²",
    "household_size": "gia đình mình có khoảng mấy người dùng",
    "usage_purpose": "anh/chị dùng chủ yếu cho mục đích gì",
    "usage_priority": "anh/chị ưu tiên điều gì nhất (pin, camera, hiệu năng, mỏng nhẹ...)",
    "device_type": "anh/chị cần loại thiết bị nào",
}

# Câu hỏi device_type riêng theo category (cụ thể hơn câu chung)
DEVICE_TYPE_QUESTIONS = {
    "loa, tai nghe": "anh/chị cần loa hay tai nghe",
    "pc, máy in": "anh/chị cần PC để bàn, màn hình, hay máy in",
}

# Giá trị mặc định an toàn khi đã hết lượt hỏi (is_assumed=true)
SLOT_DEFAULTS = {
    "room_size": (15, "phòng ngủ tiêu chuẩn ~15m²"),
    "household_size": (3, "gia đình 3-4 người"),
    "usage_purpose": (None, "nhu cầu phổ thông"),
    "usage_priority": ([], "không có ưu tiên đặc biệt"),
    "device_type": (None, "không giới hạn loại thiết bị"),
    "budget": (None, "chưa rõ ngân sách — không lọc theo giá"),
}

# NHÓM 1 — 19 category, rule viết tay
NHOM1_SCHEMA = {
    "máy lạnh": {
        "critical": ["budget", "room_size"],
        "optional": ["sun_exposure", "noise_priority", "usage_purpose"],
    },
    "tủ lạnh": {
        "critical": ["budget", "household_size"],
        "optional": ["usage_purpose"],
    },
    "máy giặt": {
        "critical": ["budget", "household_size"],
        "optional": ["door_type_preference", "usage_priority"],
    },
    "máy sấy quần áo": {
        "critical": ["budget", "household_size"],
        "optional": ["usage_purpose"],
    },
    "máy rửa chén": {
        "critical": ["budget", "household_size"],
        "optional": ["noise_priority"],
    },
    "tủ đông, tủ mát": {
        "critical": ["budget", "usage_purpose"],
        "optional": [],
    },
    "máy nước nóng": {
        "critical": ["budget"],
        "optional": ["heater_type_preference", "household_size"],
    },
    "micro": {
        "critical": ["budget"],
        "optional": ["usage_purpose"],
    },
    "đồng hồ thông minh": {
        "critical": ["budget"],
        "optional": ["usage_priority", "battery_priority"],
    },
    "máy tính bảng": {
        "critical": ["budget"],
        "optional": ["usage_priority"],
    },
    "laptop": {
        "critical": ["budget", "usage_purpose"],
        "optional": ["portability_priority"],
    },
    "điện thoại": {
        "critical": ["budget", "usage_priority"],
        "optional": ["brand_preference"],
    },
    "tivi": {
        "critical": ["budget", "usage_purpose"],
        "optional": ["screen_size_priority"],
    },
    "loa, tai nghe": {
        "critical": ["budget", "device_type"],
        "optional": ["usage_purpose", "battery_priority"],
    },
    "máy hút bụi gia đình": {
        "critical": ["budget"],
        "optional": ["household_size", "noise_priority"],
    },
    "nồi cơm điện": {
        "critical": ["household_size", "budget"],
        "optional": ["usage_purpose"],
    },
    "quạt các loại": {
        "critical": ["budget"],
        "optional": ["usage_purpose"],
    },
    "đồng hồ thời trang": {
        "critical": ["budget"],
        "optional": ["usage_purpose", "brand_preference"],
    },
    "pc, máy in": {
        "critical": ["budget", "device_type"],
        "optional": ["usage_purpose"],
    },
}

# NHÓM 2 — ~97 category phụ/nhỏ còn lại: chỉ budget là critical
DEFAULT_SCHEMA = {"critical": ["budget"], "optional": ["usage_purpose"]}


def get_schema(category_label: str | None) -> dict:
    if not category_label:
        return {"critical": ["category"], "optional": []}
    return NHOM1_SCHEMA.get(category_label.lower(), DEFAULT_SCHEMA)


def missing_criticals(category_label: str | None, slots: dict) -> list[str]:
    """category chưa xác định → category tự nó là critical duy nhất."""
    if not category_label:
        return ["category"]
    schema = get_schema(category_label)
    missing = []
    for slot in schema["critical"]:
        v = slots.get(slot)
        if v is None or v == [] or v == "":
            missing.append(slot)
    return missing


def build_clarifying_question(category_label: str | None, missing: list[str]) -> str:
    """Gộp tất cả câu hỏi còn thiếu vào 1 lượt duy nhất (không hỏi vặt nhiều lượt)."""
    parts = []
    for slot in missing:
        if slot == "device_type" and category_label:
            parts.append(DEVICE_TYPE_QUESTIONS.get(category_label.lower(),
                                                   SLOT_QUESTIONS["device_type"]))
        else:
            parts.append(SLOT_QUESTIONS.get(slot, f"cho em xin thêm thông tin về {slot}"))
    if not parts:
        return ""
    if len(parts) == 1:
        return f"Dạ, {parts[0]} ạ?"
    return "Dạ, " + ", và ".join([", ".join(parts[:-1]), parts[-1]]) + " ạ?"


def apply_defaults(slots: dict, missing: list[str]) -> list[str]:
    """Hết lượt hỏi → gán default an toàn, trả về danh sách slot đã is_assumed."""
    assumed = []
    for slot in missing:
        default, _note = SLOT_DEFAULTS.get(slot, (None, ""))
        slots[slot] = default
        assumed.append(slot)
    return assumed
