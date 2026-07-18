"""mask_pii() theo log_masking.md — regex-based, áp dụng TRƯỚC khi ghi bất kỳ log nào."""
import re

_PHONE_RE = re.compile(r"(?<!\d)(0|\+84)\d{9,10}(?!\d)")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# CCCD 12 số hoặc CMND 9 số đứng độc lập (đã mask phone trước nên không đụng số ĐT)
_ID_RE = re.compile(r"(?<!\d)\d{12}(?!\d)|(?<!\d)\d{9}(?!\d)")


def _mask_phone(m: re.Match) -> str:
    s = m.group(0)
    return s[:3] + "*" * (len(s) - 5) + s[-2:]


def _mask_email(m: re.Match) -> str:
    s = m.group(0)
    local, _, domain = s.partition("@")
    if len(local) <= 2:
        masked = local[0] + "*"
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


def _mask_id(m: re.Match) -> str:
    s = m.group(0)
    return s[:3] + "*" * (len(s) - 3)


def mask_pii(text: str) -> str:
    if not text:
        return text
    text = _PHONE_RE.sub(_mask_phone, text)
    text = _EMAIL_RE.sub(_mask_email, text)
    text = _ID_RE.sub(_mask_id, text)
    return text
