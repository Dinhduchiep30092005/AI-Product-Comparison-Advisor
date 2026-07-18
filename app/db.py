"""SQLite datastore duy nhất cho products (runtime), customer_memory, policies, alerts.

Admin PATCH ghi trực tiếp vào đây và MCP tool cũng đọc từ đây —
"không có 2 store cần đồng bộ" (API_contract.md mục 3.1).
"""
import json
import sqlite3
import threading
from contextlib import contextmanager

from app import config

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


_conn = _connect()


@contextmanager
def cursor(write: bool = False):
    if write:
        with _lock:
            cur = _conn.cursor()
            try:
                yield cur
                _conn.commit()
            finally:
                cur.close()
    else:
        cur = _conn.cursor()
        try:
            yield cur
        finally:
            cur.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    product_code TEXT PRIMARY KEY,      -- product_id thống nhất toàn hệ thống
    source_product_id TEXT,             -- product_id gốc crawl DMX (không dùng làm khóa)
    category TEXT,                      -- slug snake_case
    category_label TEXT,                -- tên hiển thị (VD "Máy lạnh")
    device_type TEXT,                   -- gắn lúc ingestion cho pc/máy in, loa/tai nghe
    product_name TEXT,
    brand TEXT,
    original_price INTEGER,
    sale_price INTEGER,
    rating REAL,
    review_count INTEGER,
    review_summary TEXT,
    quantity_sold INTEGER,
    stock_quantity INTEGER,             -- tồn kho: admin dashboard cập nhật
    stock_status TEXT,                  -- in_stock | out_of_stock
    promotion TEXT,                     -- KM riêng sản phẩm (đã tách voucher chung)
    warranty TEXT,
    color TEXT,
    accessories TEXT,
    outstanding_features TEXT,
    specs TEXT,                         -- JSON object
    image_url TEXT,
    product_url TEXT,
    online_sale_only INTEGER,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS customer_memory (
    customer_id TEXT PRIMARY KEY,
    slots_collected TEXT,               -- JSON
    products_discussed TEXT,            -- JSON list [{product_id, product_name, price_at_advice, stock_status_at_advice, discussed_at}]
    conversation_summary TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    title TEXT,
    policy_type TEXT,
    status TEXT DEFAULT 'active',       -- active | deprecated
    source_file TEXT,
    uploaded_by TEXT,
    uploaded_at TEXT,
    chunk_count INTEGER,
    replaces_policy_id TEXT
);

CREATE TABLE IF NOT EXISTS policy_chunks (
    id TEXT PRIMARY KEY,
    policy_id TEXT,
    idx INTEGER,
    section_title TEXT,
    text TEXT,
    deprecated INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id TEXT PRIMARY KEY,
    dedup_key TEXT,                     -- {customer_id}:{product_id}:{alert_type}
    customer_id TEXT,
    product_id TEXT,
    product_name TEXT,
    alert_type TEXT,                    -- PRICE_DROP | BACK_IN_STOCK
    message TEXT,
    old_price INTEGER,
    new_price INTEGER,
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup ON alerts(dedup_key);
"""


def init_schema() -> None:
    with cursor(write=True) as cur:
        cur.executescript(SCHEMA)


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if d.get("specs"):
        d["specs"] = json.loads(d["specs"])
    return d


init_schema()
