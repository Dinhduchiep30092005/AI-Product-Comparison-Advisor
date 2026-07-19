"""Session state in-memory theo customer_id (Orchestrator/Session Store —
KHÔNG thuộc MCP Server, Flow_MCP.md). Slots bền vững thì ghi xuống customer_memory."""

from app.services import memory

_sessions: dict[str, dict] = {}


def get(customer_id: str) -> dict:
    s = _sessions.get(customer_id)
    if s is None:
        s = {
            "slots": {},
            "clarify_round": 0,
            "assumed": [],          # slot đã gán default (is_assumed)
            "query_phrases": [],    # các câu mô tả nhu cầu (giữ nguyên cụm định tính)
            "history": [],          # 5 dòng gần nhất
            "last_top": [],         # top sản phẩm lượt so sánh gần nhất
            "shown_codes": [],      # product_code đã từng tư vấn trong nhu cầu này (để loại khi khách hỏi "còn máy khác")
            "last_policy_chunks": [],
            "last_enriched": {},
            # Dữ liệu chỉ có hiệu lực trong đúng một lượt chat. Khởi tạo rõ ràng
            # để không vô tình biến chúng thành conversation memory.
            "recent_tool_results": [],
            "citations": [],
            "summary": "",
            "loaded_memory": False,
        }
        # Load customer_memory từ DB TRƯỚC khi xử lý (khách quay lại / demo seed sẵn)
        mem = memory.get(customer_id)
        if mem:
            s["slots"] = dict(mem["slots_collected"])
            s["summary"] = mem["conversation_summary"] or ""
            s["loaded_memory"] = True
        _sessions[customer_id] = s
    return s


def begin_turn(s: dict) -> None:
    """Reset toàn bộ artifact chỉ thuộc lượt trước, trước khi merge slot mới."""
    s["recent_tool_results"] = []
    s["citations"] = []
    s["last_policy_chunks"] = []
    s["last_enriched"] = {}


def reset_need(s: dict) -> None:
    """Khách đổi sang nhu cầu/category mới → xoá slot cũ (budget/room_size/... của
    category trước không còn liên quan) + reset vòng hỏi + mô tả cũ.

    last_top PHẢI xoá theo — nếu không, khi khách trả lời câu hỏi làm rõ của
    nhu cầu MỚI mà slot-filling lặp lại nguyên giá trị vừa nêu (không thêm
    tiêu chí gì), orchestrator hiểu nhầm "không có gì mới" và tái sử dụng
    last_top — tức sản phẩm của category CŨ (VD hỏi máy giặt nhưng ra laptop
    của nhu cầu trước đó trong cùng phiên chat)."""
    s["slots"] = {}
    s["clarify_round"] = 0
    s["assumed"] = []
    s["query_phrases"] = []
    s["shown_codes"] = []
    s["last_top"] = []


def push_history(s: dict, line: str) -> None:
    s["history"].append(line)
    s["history"] = s["history"][-5:]
