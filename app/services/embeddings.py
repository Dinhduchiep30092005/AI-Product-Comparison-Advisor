"""Embedding (Vietnamese_Embedding) + Reranker (bge-reranker-v2-m3) — lazy singleton.

Model chỉ load khi dùng lần đầu (tránh chậm lúc chạy pipeline không cần vector).
"""
import threading

from app import config

_lock = threading.Lock()
_embedder = None
_reranker = None


def _adapt_onnx_output_names(model) -> None:
    """Bridge ONNX exports that name hidden states ``token_embeddings``.

    Vietnamese_Embedding's ONNX graph exposes ``token_embeddings`` rather
    than Optimum's expected ``last_hidden_state``.  SentenceTransformers'
    pooling module needs the latter name.
    """
    transformer = model[0]
    ort_model = transformer.auto_model
    output_names = {output.name for output in ort_model.model.get_outputs()}
    if "last_hidden_state" in output_names or "token_embeddings" not in output_names:
        return

    import torch
    from transformers.modeling_outputs import BaseModelOutput

    def forward(input_ids=None, attention_mask=None, **_kwargs):
        inputs = {
            "input_ids": input_ids.detach().cpu().numpy(),
            "attention_mask": attention_mask.detach().cpu().numpy(),
        }
        names = [output.name for output in ort_model.model.get_outputs()]
        values = ort_model.model.run(names, inputs)
        outputs = dict(zip(names, values, strict=True))
        return BaseModelOutput(
            last_hidden_state=torch.from_numpy(outputs["token_embeddings"])
        )

    ort_model.forward = forward


def get_embedder():
    global _embedder
    if _embedder is None:
        with _lock:
            if _embedder is None:
                from sentence_transformers import SentenceTransformer
                model_kwargs = None
                if config.EMBEDDING_BACKEND == "onnx":
                    import onnxruntime as ort

                    provider = config.EMBEDDING_ONNX_PROVIDER
                    if provider not in ort.get_available_providers():
                        raise RuntimeError(
                            f"ONNX provider {provider!r} is unavailable; "
                            f"available providers: {ort.get_available_providers()}"
                        )
                    model_kwargs = {"provider": provider}
                _embedder = SentenceTransformer(
                    config.EMBEDDING_MODEL,
                    backend=config.EMBEDDING_BACKEND,
                    model_kwargs=model_kwargs,
                )
                if config.EMBEDDING_BACKEND == "onnx":
                    _adapt_onnx_output_names(_embedder)
    return _embedder


def get_reranker():
    global _reranker
    if _reranker is None:
        with _lock:
            if _reranker is None:
                from sentence_transformers import CrossEncoder
                _reranker = CrossEncoder(config.RERANKER_MODEL)
    return _reranker


def embed(texts: list[str]) -> list[list[float]]:
    return get_embedder().encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        batch_size=config.EMBEDDING_BATCH_SIZE,
    ).tolist()


def rerank(query: str, docs: list[str]) -> list[float]:
    """Trả điểm rerank cho từng doc (cùng thứ tự input)."""
    if not docs:
        return []
    scores = get_reranker().predict([(query, d) for d in docs])
    return [float(s) for s in scores]


def warm_up() -> None:
    """Load embedder + reranker ngay lúc app khởi động thay vì đợi request đầu
    tiên của khách (lazy-load cold start ~20s+, thấy rõ nhất ngay sau mỗi lần
    restart/reload lúc dev)."""
    embed(["khởi động"])
    rerank("khởi động", ["khởi động"])
