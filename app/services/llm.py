"""Client LLM qua FPT AI Marketplace (OpenAI-compatible).

Model chính: DeepSeek-V4-Flash. Lỗi provider → thử LLM_FALLBACK_MODEL (gpt-oss-120b)
1 lần rồi mới báo lỗi (MVP: fallback đơn giản, chưa routing thông minh).
"""
import json
import re

from openai import OpenAI

from app import config

_client = OpenAI(api_key=config.FPT_API_KEY, base_url=config.FPT_BASE_URL)


def chat(messages: list[dict], tools: list[dict] | None = None,
         temperature: float = 0.3, max_tokens: int = 2000):
    """Trả về message object (có thể chứa tool_calls)."""
    last_err = None
    for model in (config.LLM_MODEL, config.LLM_FALLBACK_MODEL):
        try:
            kwargs = dict(model=model, messages=messages,
                          temperature=temperature, max_tokens=max_tokens)
            if tools:
                kwargs["tools"] = tools
            resp = _client.chat.completions.create(**kwargs)
            return resp.choices[0].message
        except Exception as e:  # provider down/throttle → fallback model
            last_err = e
    raise last_err


def chat_json(messages: list[dict], temperature: float = 0.1, max_tokens: int = 1500) -> dict:
    """Gọi LLM yêu cầu trả JSON, parse an toàn (kể cả khi model bọc ```json)."""
    msg = chat(messages, temperature=temperature, max_tokens=max_tokens)
    return parse_json(msg.content or "")


def parse_json(text: str) -> dict:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # cứu vãn: lấy khối {...} ngoài cùng
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return {}
