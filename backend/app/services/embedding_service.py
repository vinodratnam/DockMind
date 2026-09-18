"""
Embedding Service — Singleton wrapper around BAAI/bge-small-en-v1.5.

Design:
  - Model is loaded ONCE at application startup (expensive: ~100MB download, ~1-2s load)
  - Subsequent calls reuse the loaded model (fast: <50ms per batch)
  - Generates 384-dimensional L2-normalised float32 vectors
  - Runs on CPU by default; no GPU required

Usage:
    from app.services.embedding_service import embedding_service

    vector: list[float] = embedding_service.embed_one("some text")
    vectors: list[list[float]] = embedding_service.embed_many(["text1", "text2"])
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Singleton service that loads the sentence-transformer model once
    and exposes synchronous embedding methods.

    Async wrappers are provided for use inside FastAPI route handlers.
    """

    def __init__(self) -> None:
        self._model = None
        self._model_name: str = settings.EMBEDDING_MODEL
        self._vector_dim: Optional[int] = None

    # ── Initialisation ─────────────────────────────────────────────────────

    def load(self) -> None:
        """
        Load the embedding model into memory.
        Call this once during application startup via the lifespan hook.
        """
        if self._model is not None:
            return  # Already loaded

        logger.info("Loading embedding model: %s", self._model_name)
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
            # Determine vector dimension by embedding an empty string
            test_vec = self._model.encode(["test"], normalize_embeddings=True)
            self._vector_dim = int(test_vec.shape[1])
            logger.info(
                "Embedding model loaded. dim=%d model=%s",
                self._vector_dim,
                self._model_name,
            )
        except Exception as exc:
            logger.error("Failed to load embedding model: %s", exc)
            raise RuntimeError(f"Could not load embedding model '{self._model_name}': {exc}") from exc

    def unload(self) -> None:
        """Release the model from memory (called on shutdown)."""
        self._model = None
        logger.info("Embedding model unloaded.")

    # ── Properties ─────────────────────────────────────────────────────────

    @property
    def vector_dim(self) -> int:
        """Return the embedding dimension (e.g. 384 for bge-small)."""
        if self._vector_dim is None:
            raise RuntimeError("Embedding model not loaded. Call load() first.")
        return self._vector_dim

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    # ── Core methods ───────────────────────────────────────────────────────

    def embed_one(self, text: str) -> list[float]:
        """
        Embed a single text string.

        Returns a list[float] of length `vector_dim`.
        """
        if self._model is None:
            raise RuntimeError("Embedding model not loaded.")
        vec = self._model.encode(
            [text],
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=1,
        )
        return vec[0].tolist()

    def embed_many(
        self,
        texts: list[str],
        batch_size: int | None = None,
    ) -> list[list[float]]:
        """
        Embed a list of text strings in batches.

        Returns list[list[float]] — one vector per input text.
        Batching avoids OOM errors on large chunk sets.
        """
        if self._model is None:
            raise RuntimeError("Embedding model not loaded.")
        if not texts:
            return []

        bs = batch_size or settings.EMBEDDING_BATCH_SIZE

        vecs = self._model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=bs,
        )
        return [v.tolist() for v in vecs]


# ── Module-level singleton ─────────────────────────────────────────────────
embedding_service = EmbeddingService()
