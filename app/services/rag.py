"""Vector search (ChromaDB) + rerank cho catalog_collection và policy_collection."""
import chromadb

from app import config
from app.services import embeddings

_client = None


def client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    return _client


def catalog_collection():
    return client().get_or_create_collection("catalog_collection", metadata={"hnsw:space": "cosine"})


def policy_collection():
    return client().get_or_create_collection("policy_collection", metadata={"hnsw:space": "cosine"})


def _build_where(conditions: list[dict]):
    conditions = [c for c in conditions if c]
    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def _cosine_similarity(distance) -> float:
    """Chroma cosine distance = 1 - cosine similarity."""
    return 1.0 - float(distance)


def inspect_catalog_category(category: str) -> dict:
    """Thông tin chẩn đoán nhẹ cho metadata category đang có trong Chroma."""
    if not category:
        return {"category": category, "present": False, "stored": None}
    res = catalog_collection().get(
        where={"category": category}, limit=1, include=["metadatas"])
    meta = (res.get("metadatas") or [None])[0]
    return {
        "category": category,
        "present": bool(meta),
        "stored": ({"category": meta.get("category"),
                    "category_label": meta.get("category_label")} if meta else None),
    }


def search_catalog(query: str, category: str | None = None, budget: int | None = None,
                   device_type: str | None = None, top_k: int = config.VECTOR_TOP_K,
                   min_similarity: float | None = None):
    """Metadata pre-filter (category, price, device_type) → vector search top 15-20.

    Budget nới 1.3x ở tầng pre-filter — hard filter chính xác là việc của Domain
    Rule Engine (tránh loại oan sản phẩm sát ngưỡng trước khi rule engine nới dần).
    """
    where = _build_where([
        {"category": category} if category else None,
        {"price": {"$lte": int(budget * 1.3)}} if budget else None,
        {"device_type": device_type} if device_type else None,
    ])
    emb = embeddings.embed([query])
    res = catalog_collection().query(
        query_embeddings=emb, n_results=top_k, where=where,
        include=["documents", "metadatas", "distances"],
    )
    threshold = (config.CATALOG_MIN_SIMILARITY
                 if min_similarity is None else min_similarity)
    out = []
    for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        similarity = _cosine_similarity(dist)
        if similarity < threshold:
            continue
        out.append({"product_code": meta["product_code"], "doc": doc,
                    "metadata": meta, "distance": dist, "similarity": similarity})
    return out


def rerank_candidates(query: str, candidates: list[dict], top_k: int = config.RERANK_TOP_K):
    """bge-reranker-v2-m3 → top 5 candidate, gắn rerank_score."""
    scores = embeddings.rerank(query, [c["doc"] for c in candidates])
    for c, s in zip(candidates, scores):
        c["rerank_score"] = s
    return sorted(candidates, key=lambda c: c["rerank_score"], reverse=True)[:top_k]


def search_policy_chunks(query: str, policy_type: str | None = None, top_k: int = 4,
                         min_similarity: float | None = None):
    """CHỈ query chunk deprecated=False (flow_data_policy.md)."""
    where = _build_where([
        {"deprecated": False},
        {"policy_type": policy_type} if policy_type else None,
    ])
    emb = embeddings.embed([query])
    res = policy_collection().query(
        query_embeddings=emb, n_results=top_k, where=where,
        include=["documents", "metadatas", "distances"],
    )
    threshold = (config.POLICY_MIN_SIMILARITY
                 if min_similarity is None else min_similarity)
    out = []
    for doc, meta, dist in zip(
            res["documents"][0], res["metadatas"][0], res["distances"][0]):
        similarity = _cosine_similarity(dist)
        if similarity < threshold:
            continue
        out.append({
            "chunk_text": doc,
            "policy_type": meta.get("policy_type"),
            "source_document": meta.get("source_document"),
            "section_title": meta.get("section_title"),
            "distance": float(dist),
            "similarity": similarity,
        })
    return out


def add_policy_chunks(policy_id: str, policy_type: str, source_document: str,
                      chunks: list[dict]) -> None:
    """Embed + lưu chunk chính sách mới (admin upload hoặc ingest ban đầu)."""
    if not chunks:
        return
    ids = [f"{policy_id}_{c['index']}" for c in chunks]
    docs = [c["text"] for c in chunks]
    metas = [{
        "policy_id": policy_id,
        "policy_type": policy_type,
        "source_document": source_document,
        "section_title": c.get("section_title") or "",
        "deprecated": False,
    } for c in chunks]
    policy_collection().upsert(
        ids=ids, documents=docs, metadatas=metas, embeddings=embeddings.embed(docs),
    )


def deprecate_policy(policy_id: str) -> None:
    """Đánh dấu deprecated=true toàn bộ chunk của 1 policy (không xoá hẳn)."""
    col = policy_collection()
    res = col.get(where={"policy_id": policy_id}, include=["metadatas"])
    if not res["ids"]:
        return
    for meta in res["metadatas"]:
        meta["deprecated"] = True
    col.update(ids=res["ids"], metadatas=res["metadatas"])
