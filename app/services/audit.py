"""Audit log — MỌI bản ghi đi qua mask_pii() trước khi ghi (log_masking.md)."""
import json
from datetime import datetime

from app import config
from app.masking import mask_pii

_LOG_FILE = config.LOG_DIR / "audit.log"


def log(event: str, route: str | None = None, **fields) -> None:
    record = {
        "ts": datetime.now().astimezone().isoformat(timespec="seconds"),
        "event": event,
    }
    if route:
        record["route"] = route  # tool_calling | keyword
    for k, v in fields.items():
        if isinstance(v, str):
            v = mask_pii(v)
        record[k] = v
    with open(_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
