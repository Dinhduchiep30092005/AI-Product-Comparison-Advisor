"""Embedding (Vietnamese_Embedding) + Reranker (bge-reranker-v2-m3) qua FPT AI
Factory API — cùng provider/API key với LLM (app/services/llm.py). Không load
model cục bộ (torch/sentence-transformers ~3.2GB RAM, vượt free tier deploy).
"""
import httpx

from app import config
from app.services.llm import _client

_RERANK_URL = config.FPT_BASE_URL.rstrip("/") + "/v1/rerank"


def embed(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    resp = _client.embeddings.create(model=config.EMBEDDING_MODEL, input=texts)
    return [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]


def rerank(query: str, docs: list[str]) -> list[float]:
    """Trả điểm rerank cho từng doc (cùng thứ tự input)."""
    if not docs:
        return []
    resp = httpx.post(
        _RERANK_URL,
        headers={"Authorization": f"Bearer {config.FPT_API_KEY}"},
        json={"model": config.RERANKER_MODEL, "query": query, "documents": docs},
        timeout=30,
    )
    resp.raise_for_status()
    scores = [0.0] * len(docs)
    for r in resp.json()["results"]:
        scores[r["index"]] = r["relevance_score"]
    return scores
