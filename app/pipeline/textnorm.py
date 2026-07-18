"""Chuẩn hoá text dùng chung (data_normalization.md mục 6a + flow_data_policy.md).

- Decode HTML entity, xoá khoảng trắng thừa, chuẩn hoá Unicode NFC
- Không tự sửa tên model/mã sản phẩm
- slugify: bỏ dấu tiếng Việt + snake_case (cho category slug và key specs)
"""
import html
import re
import unicodedata

_EMPTY_VALUES = {"", "n/a", "na", "nan", "none", "null", "-"}


def clean_text(value):
    """Trả về text đã chuẩn hoá, hoặc None nếu là giá trị rỗng."""
    if value is None:
        return None
    if isinstance(value, float) and value != value:  # NaN
        return None
    s = str(value)
    s = html.unescape(s)
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.lower() in _EMPTY_VALUES:
        return None
    return s


def strip_diacritics(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def slugify(s: str) -> str:
    """VD "Quạt các loại" -> "quat_cac_loai"; "Công suất" -> "cong_suat"."""
    s = strip_diacritics(clean_text(s) or "")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")
