"""Tool spec cho LLM tool-calling (Luồng B) — mirror registry, KHÔNG expose cost_price.

Description nói rõ: mục đích — dùng khi nào — không dùng khi nào (Flow_MCP.md).
Format: OpenAI function-calling (FPT endpoint tương thích OpenAI).
"""
from app import config

TOOL_SPECS = [
    {
        "type": "function",
        "function": {
            "name": "get_product_price",
            "description": (
                "Lấy giá bán hiện tại (real-time) của 1 sản phẩm theo product_id. "
                "Dùng khi khách hỏi giá một sản phẩm cụ thể. "
                "KHÔNG dùng để đoán giá sản phẩm không có trong catalog."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "Mã sản phẩm (product_code chuẩn hoá)"},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_stock",
            "description": (
                "Kiểm tra tồn kho hiện tại của 1 sản phẩm. "
                "Dùng khi khách hỏi còn hàng không/còn bao nhiêu. "
                "KHÔNG dùng khi khách chỉ hỏi thông số kỹ thuật."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string"},
                    "store_id": {"type": ["string", "null"], "description": "Mã cửa hàng, null nếu toàn hệ thống"},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_promotion",
            "description": (
                "Lấy khuyến mãi đang áp dụng của 1 sản phẩm. "
                "Dùng khi khách hỏi khuyến mãi/quà tặng/giảm giá của sản phẩm cụ thể. "
                "KHÔNG dùng cho câu hỏi chính sách chung (dùng search_policy)."
            ),
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_review",
            "description": (
                "Lấy tóm tắt đánh giá (rating, số lượt, nhận xét nổi bật) của 1 sản phẩm. "
                "Dùng khi khách hỏi sản phẩm được đánh giá thế nào. "
                "KHÔNG tự bịa nội dung review khi dữ liệu trống."
            ),
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_policy",
            "description": (
                "Tra cứu chính sách cửa hàng (bảo hành, đổi trả, giao hàng lắp đặt, trả góp, "
                "bảo mật, điều khoản). Dùng khi khách hỏi về chính sách/quy định chung. "
                "KHÔNG dùng để lấy giá/tồn kho sản phẩm."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Câu hỏi chính sách bằng tiếng Việt"},
                    "policy_type": {
                        "type": ["string", "null"],
                        "enum": config.POLICY_TYPES + [None],
                        "description": "Filter theo loại chính sách, null nếu không chắc",
                    },
                },
                "required": ["query"],
            },
        },
    },
]
