"""
Vector Store Service — Production-grade Qdrant integration.

Architecture (SOLID):
  ┌─────────────────────────────────────────────────────────┐
  │                 VectorStoreService                       │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
  │  │Connection│ │Collection│ │  Upsert  │ │  Search  │  │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
  │  │  Delete  │ │  Health  │ │Validation│ │ Logging  │  │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
  └─────────────────────────────────────────────────────────┘

Enhancements over Day 5 baseline:
  ✓ Rich metadata payload (full content, original_filename, schema_version, etc.)
  ✓ Payload indexes (document_id, page_number, chunk_index) for fast filtered search
  ✓ Collection metadata stored internally (dim, metric, model, collection name)
  ✓ Duplicate-aware upsert (always replaces — idempotent)
  ✓ Batch upsert with configurable batch_size (default 100)
  ✓ Full search response (content, filename, model, scores, all metadata)
  ✓ Rich delete response dict
  ✓ Enhanced health endpoint (dim, metric, model, mode, status)
  ✓ Startup validation (dim mismatch detection)
  ✓ Structured logging throughout
  ✓ Metadata schema_version for future payload migrations
  ✓ Configurable search (top_k, score_threshold, document filter, multi-doc)
"""
import datetime
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Current payload schema version — increment when payload fields change
SCHEMA_VERSION = 1
DISTANCE_METRIC = "Cosine"


class VectorStoreService:
    """
    Singleton wrapper around the Qdrant client.

    All heavy I/O (upsert, search) should be called from
    asyncio.get_event_loop().run_in_executor() to avoid blocking the event loop.
    """

    def __init__(self) -> None:
        self._client = None
        self._collection:   str          = settings.QDRANT_COLLECTION
        self._vector_dim:   Optional[int] = None
        self._embedding_model: str        = settings.EMBEDDING_MODEL
        self._mode:         str           = settings.QDRANT_MODE

    # ══════════════════════════════════════════════════════════════════════════
    # CONNECTION
    # ══════════════════════════════════════════════════════════════════════════

    def connect(self, vector_dim: int) -> None:
        """
        Connect to Qdrant, create the collection if needed, and build indexes.

        Called once at application startup from the FastAPI lifespan hook.

        Modes:
          "memory" — in-process Qdrant, no Docker required (resets on restart)
          "http"   — persistent Qdrant server over HTTP

        Raises RuntimeError if dimensions mismatch an existing collection.
        """
        from qdrant_client import QdrantClient

        logger.info(
            "[VectorStore] Connecting (mode=%s, collection=%s, dim=%d)...",
            self._mode, self._collection, vector_dim,
        )

        try:
            self._client = self._build_client()
            self._vector_dim = vector_dim
            self._ensure_collection(vector_dim)
            self._ensure_payload_indexes()
            logger.info(
                "[VectorStore] Ready — collection=%s dim=%d metric=%s model=%s",
                self._collection, vector_dim, DISTANCE_METRIC, self._embedding_model,
            )
        except Exception as exc:
            logger.error("[VectorStore] Connection failed: %s", exc)
            self._client = None
            # Don't raise — app continues without vector search

    def _build_client(self):
        """Construct the Qdrant client based on QDRANT_MODE."""
        from qdrant_client import QdrantClient

        if self._mode == "memory":
            client = QdrantClient(":memory:")
            logger.info("[VectorStore] Using in-memory Qdrant (no Docker required).")
        else:
            client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                timeout=15,
            )
            logger.info(
                "[VectorStore] Connected to Qdrant server at %s:%s",
                settings.QDRANT_HOST, settings.QDRANT_PORT,
            )
        return client

    # ══════════════════════════════════════════════════════════════════════════
    # COLLECTION MANAGEMENT
    # ══════════════════════════════════════════════════════════════════════════

    def _ensure_collection(self, vector_dim: int) -> None:
        """
        Create the vector collection if it doesn't exist.
        If it does exist, validate the dimension matches to catch model mismatches.
        """
        from qdrant_client.models import Distance, VectorParams

        existing = {c.name for c in self._client.get_collections().collections}

        if self._collection not in existing:
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(
                    size=vector_dim,
                    distance=Distance.COSINE,
                    on_disk=False,          # Keep in RAM for fast retrieval
                ),
            )
            logger.info(
                "[VectorStore] Collection created: '%s' (dim=%d, metric=Cosine)",
                self._collection, vector_dim,
            )
        else:
            # Validate dimension matches
            info = self._client.get_collection(self._collection)
            existing_dim = info.config.params.vectors.size
            if existing_dim != vector_dim:
                raise RuntimeError(
                    f"[VectorStore] Dimension mismatch! "
                    f"Collection '{self._collection}' has dim={existing_dim} "
                    f"but embedding model produces dim={vector_dim}. "
                    f"Delete the collection or switch to the correct model."
                )
            logger.info(
                "[VectorStore] Collection '%s' already exists (dim=%d). OK.",
                self._collection, vector_dim,
            )

    def _ensure_payload_indexes(self) -> None:
        """
        Create payload field indexes for fast filtered search.
        Indexes are idempotent — safe to call on existing collections.

        Indexed fields:
          document_id  → keyword (used to filter by user's document)
          page_number  → integer (useful for page-scoped search)
          chunk_index  → integer (ordering)
        """
        from qdrant_client.models import PayloadSchemaType

        indexes = {
            "document_id": PayloadSchemaType.INTEGER,
            "page_number":  PayloadSchemaType.INTEGER,
            "chunk_index":  PayloadSchemaType.INTEGER,
        }

        for field, schema_type in indexes.items():
            try:
                self._client.create_payload_index(
                    collection_name=self._collection,
                    field_name=field,
                    field_schema=schema_type,
                )
                logger.info("[VectorStore] Payload index created: %s", field)
            except Exception:
                # Index already exists — this is expected on restart
                pass

    # ══════════════════════════════════════════════════════════════════════════
    # PROPERTIES
    # ══════════════════════════════════════════════════════════════════════════

    @property
    def is_connected(self) -> bool:
        return self._client is not None

    @property
    def vector_dim(self) -> Optional[int]:
        return self._vector_dim

    @property
    def collection_name(self) -> str:
        return self._collection

    @property
    def embedding_model(self) -> str:
        return self._embedding_model

    # ══════════════════════════════════════════════════════════════════════════
    # UPSERT (BATCH)
    # ══════════════════════════════════════════════════════════════════════════

    def upsert_chunks(
        self,
        chunks: list[dict],
        vectors: list[list[float]],
        batch_size: int = 100,
    ) -> int:
        """
        Insert or update vectors in Qdrant in configurable batches.

        Each vector is stored with a rich metadata payload:
          - document_id, chunk_id, page_number, chunk_index
          - original_filename  (for citations in Day 6 RAG)
          - content            (FULL text — required for LLM context)
          - text_preview       (first 200 chars for inspection)
          - character_count, estimated_token_count
          - embedding_model    (tracks which model was used)
          - indexed_at         (ISO 8601 UTC timestamp)
          - schema_version     (for future payload migrations)

        Args:
            chunks:     List of chunk dicts from PostgreSQL
            vectors:    Parallel list of embedding vectors
            batch_size: Max vectors per Qdrant upsert call (default 100)

        Returns:
            Total number of points upserted.
        """
        if not self._client:
            raise RuntimeError("[VectorStore] Not connected. Call connect() first.")
        if len(chunks) != len(vectors):
            raise ValueError(
                f"[VectorStore] Mismatch: {len(chunks)} chunks vs {len(vectors)} vectors."
            )
        if not chunks:
            logger.info("[VectorStore] No chunks to upsert.")
            return 0

        from qdrant_client.models import PointStruct

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        total_upserted = 0

        # Build all points first
        points = [
            PointStruct(
                id=chunk["id"],
                vector=vector,
                payload=self._build_payload(chunk, now_iso),
            )
            for chunk, vector in zip(chunks, vectors)
        ]

        # Batch upsert
        for batch_start in range(0, len(points), batch_size):
            batch = points[batch_start: batch_start + batch_size]
            self._client.upsert(
                collection_name=self._collection,
                points=batch,
                wait=True,
            )
            total_upserted += len(batch)
            logger.info(
                "[VectorStore] Upserted batch %d-%d (%d/%d points)",
                batch_start + 1,
                batch_start + len(batch),
                total_upserted,
                len(points),
            )

        logger.info(
            "[VectorStore] Upsert complete — %d vectors stored in collection '%s'.",
            total_upserted, self._collection,
        )
        return total_upserted

    def _build_payload(self, chunk: dict, indexed_at: str) -> dict:
        """Construct the standardised Qdrant payload for a chunk."""
        content = chunk.get("content", "")
        return {
            # ── Identity ─────────────────────────────────────────────
            "document_id":           chunk["document_id"],
            "chunk_id":              chunk["id"],
            "page_number":           chunk["page_number"],
            "chunk_index":           chunk["chunk_index"],
            # ── Source citation ───────────────────────────────────────
            "original_filename":     chunk.get("original_filename", ""),
            # ── Content (FULL text for RAG context) ───────────────────
            "content":               content,
            "text_preview":          content[:200],
            # ── Stats ─────────────────────────────────────────────────
            "character_count":       chunk.get("character_count", len(content)),
            "estimated_token_count": chunk.get("estimated_token_count", len(content) // 4),
            # ── Provenance ────────────────────────────────────────────
            "embedding_model":       self._embedding_model,
            "indexed_at":            indexed_at,
            # ── Versioning ────────────────────────────────────────────
            "schema_version":        SCHEMA_VERSION,
        }

    # ══════════════════════════════════════════════════════════════════════════
    # DELETE
    # ══════════════════════════════════════════════════════════════════════════

    def delete_by_document(self, document_id: int) -> dict:
        """
        Delete all vectors belonging to a document from Qdrant.

        Called when a document is deleted from PostgreSQL.
        Returns a rich response dict instead of a bare int.

        Returns:
            {success, document_id, deleted_from_qdrant, timestamp}
        """
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if not self._client:
            logger.warning(
                "[VectorStore] Not connected — skipping delete for document_id=%d.", document_id
            )
            return {
                "success":             False,
                "document_id":         document_id,
                "deleted_from_qdrant": False,
                "timestamp":           timestamp,
                "reason":              "Qdrant not connected",
            }

        from qdrant_client.models import Filter, FieldCondition, MatchValue

        try:
            self._client.delete(
                collection_name=self._collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id),
                        )
                    ]
                ),
                wait=True,
            )
            logger.info(
                "[VectorStore] Deleted vectors for document_id=%d at %s",
                document_id, timestamp,
            )
            return {
                "success":             True,
                "document_id":         document_id,
                "deleted_from_qdrant": True,
                "timestamp":           timestamp,
            }
        except Exception as exc:
            logger.error(
                "[VectorStore] Delete failed for document_id=%d: %s", document_id, exc
            )
            return {
                "success":             False,
                "document_id":         document_id,
                "deleted_from_qdrant": False,
                "timestamp":           timestamp,
                "reason":              str(exc),
            }

    def has_document_vectors(self, document_id: int) -> bool:
        """Check if any vectors exist in Qdrant for the given document_id."""
        if not self._client:
            return False
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        try:
            count_result = self._client.count(
                collection_name=self._collection,
                count_filter=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id),
                        )
                    ]
                )
            )
            return count_result.count > 0
        except Exception:
            return False


    # ══════════════════════════════════════════════════════════════════════════
    # SEARCH  (Day 6 ready)
    # ══════════════════════════════════════════════════════════════════════════

    def search(
        self,
        query_vector: list[float],
        document_id: Optional[int] = None,
        top_k: int = 5,
        score_threshold: float = 0.3,
    ) -> list[dict]:
        """
        Semantic similarity search over indexed chunks.

        Args:
            query_vector:    Embedded question text (must match collection dim)
            document_id:     Restrict to this document (None = search all docs)
            top_k:           Max results to return
            score_threshold: Min cosine similarity score (0.0–1.0)

        Returns:
            List of result dicts with FULL payload for RAG context building:
              chunk_id, document_id, page_number, chunk_index,
              content (FULL), text_preview, original_filename,
              embedding_model, score, character_count, estimated_token_count
        """
        if not self._client:
            raise RuntimeError("[VectorStore] Not connected.")

        from qdrant_client.models import Filter, FieldCondition, MatchValue

        query_filter = None
        if document_id is not None:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id),
                    )
                ]
            )

        logger.info(
            "[VectorStore] Searching — doc_filter=%s top_k=%d threshold=%.2f",
            document_id, top_k, score_threshold,
        )

        # qdrant-client 1.13+ uses query_points() — search() was removed in 1.13
        response = self._client.query_points(
            collection_name=self._collection,
            query=query_vector,
            query_filter=query_filter,
            limit=top_k,
            score_threshold=score_threshold,
            with_payload=True,
        )

        hits = [
            {
                "chunk_id":              r.payload.get("chunk_id"),
                "document_id":           r.payload.get("document_id"),
                "page_number":           r.payload.get("page_number"),
                "chunk_index":           r.payload.get("chunk_index"),
                "content":               r.payload.get("content", ""),
                "text_preview":          r.payload.get("text_preview", ""),
                "original_filename":     r.payload.get("original_filename", ""),
                "embedding_model":       r.payload.get("embedding_model", ""),
                "character_count":       r.payload.get("character_count"),
                "estimated_token_count": r.payload.get("estimated_token_count"),
                "score":                 round(r.score, 4),
            }
            for r in response.points
        ]

        logger.info("[VectorStore] Search returned %d results.", len(hits))
        return hits

    def scroll_chunks(
        self,
        document_id: Optional[int] = None,
        limit: int = 1000,
    ) -> list[dict]:
        """
        Scroll all chunk payloads from Qdrant for a given document (or all docs).

        Used by the hybrid search BM25 stage to build a corpus of texts.
        Unlike search(), this does NOT need a query vector — it just retrieves payloads.

        Args:
            document_id: If set, only returns chunks for this document.
            limit:        Maximum number of chunks to fetch per scroll.

        Returns:
            List of chunk dicts with the same fields as search() results.
        """
        if not self._client:
            return []

        from qdrant_client.models import Filter, FieldCondition, MatchValue

        scroll_filter = None
        if document_id is not None:
            scroll_filter = Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            )

        try:
            all_chunks: list[dict] = []
            offset = None

            while True:
                result, next_offset = self._client.scroll(
                    collection_name=self._collection,
                    scroll_filter=scroll_filter,
                    limit=limit,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                for r in result:
                    p = r.payload or {}
                    all_chunks.append({
                        "chunk_id":              p.get("chunk_id"),
                        "document_id":           p.get("document_id"),
                        "page_number":           p.get("page_number"),
                        "chunk_index":           p.get("chunk_index"),
                        "content":               p.get("content", ""),
                        "text_preview":          p.get("text_preview", ""),
                        "original_filename":     p.get("original_filename", ""),
                        "embedding_model":       p.get("embedding_model", ""),
                        "character_count":       p.get("character_count"),
                        "estimated_token_count": p.get("estimated_token_count"),
                        "score":                 0.0,  # N/A for scroll
                    })

                if next_offset is None:
                    break
                offset = next_offset

            logger.info("[VectorStore] Scroll returned %d chunks (doc=%s).", len(all_chunks), document_id)
            return all_chunks

        except Exception as exc:
            logger.error("[VectorStore] Scroll failed: %s", exc)
            return []

    # ══════════════════════════════════════════════════════════════════════════
    # HEALTH & VALIDATION
    # ══════════════════════════════════════════════════════════════════════════

    def health(self) -> dict:
        """
        Rich health report for monitoring and Swagger UI.

        Returns:
            {connected, collection, vector_dimension, distance_metric,
             embedding_model, vector_count, collection_status, qdrant_mode}
        """
        logger.info("[VectorStore] Health check requested.")

        if not self._client:
            return {
                "connected":        False,
                "collection":       self._collection,
                "vector_dimension": self._vector_dim,
                "distance_metric":  DISTANCE_METRIC,
                "embedding_model":  self._embedding_model,
                "vector_count":     None,
                "collection_status": "unavailable",
                "qdrant_mode":      self._mode,
                "error":            "Qdrant not connected",
            }

        try:
            info = self._client.get_collection(self._collection)
            # qdrant-client 1.x uses points_count; older versions used vectors_count
            vec_count = getattr(info, "vectors_count", None) or getattr(info, "points_count", None) or 0
            return {
                "connected":         True,
                "collection":        self._collection,
                "vector_dimension":  self._vector_dim,
                "distance_metric":   DISTANCE_METRIC,
                "embedding_model":   self._embedding_model,
                "vector_count":      vec_count,
                "collection_status": str(info.status),
                "qdrant_mode":       self._mode,
            }
        except Exception as exc:
            logger.error("[VectorStore] Health check failed: %s", exc)
            return {
                "connected":         False,
                "collection":        self._collection,
                "vector_dimension":  self._vector_dim,
                "distance_metric":   DISTANCE_METRIC,
                "embedding_model":   self._embedding_model,
                "vector_count":      None,
                "collection_status": "error",
                "qdrant_mode":       self._mode,
                "error":             str(exc),
            }

    def validate_startup(self) -> list[str]:
        """
        Run post-startup validation checks.

        Returns a list of warning/error strings (empty = all good).
        Used in the lifespan hook for startup diagnostics.
        """
        from app.services.embedding_service import embedding_service

        issues = []

        if not embedding_service.is_loaded:
            issues.append("Embedding model is NOT loaded.")

        if not self.is_connected:
            issues.append("Qdrant is NOT connected.")

        if embedding_service.is_loaded and self._vector_dim is not None:
            if embedding_service.vector_dim != self._vector_dim:
                issues.append(
                    f"Dimension mismatch: embedding model outputs "
                    f"{embedding_service.vector_dim}d but collection expects {self._vector_dim}d."
                )

        if issues:
            for issue in issues:
                logger.warning("[VectorStore] Startup issue: %s", issue)
        else:
            logger.info("[VectorStore] Startup validation passed.")

        return issues


# ── Module-level singleton ─────────────────────────────────────────────────
vector_store = VectorStoreService()
