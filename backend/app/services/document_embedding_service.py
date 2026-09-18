"""
Document Embedding Service — orchestrates chunk → embedding → Qdrant pipeline.

Enhancements:
  ✓ Duplicate prevention: skips documents already fully embedded (all chunks embedded)
  ✓ Passes original_filename to Qdrant payload for citation support
  ✓ Structured logging at every pipeline stage
  ✓ Configurable batch size from settings
  ✓ Clear error messages with stage information
  ✓ run_in_executor for CPU-bound work (non-blocking async)

Called by:  POST /api/v1/documents/{id}/embed
"""
import asyncio
import datetime
import logging
import time
from functools import partial

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status

from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.services.embedding_service import embedding_service
from app.services.vector_store_service import vector_store

logger = logging.getLogger(__name__)


async def embed_document(
    db: AsyncSession,
    document: Document,
    force: bool = False,
) -> dict:
    """
    Full embedding pipeline for a single document.

    Steps:
      1. Guard: document must be in 'processed' state
      2. Duplicate check: skip if all chunks already 'embedded' (unless force=True)
      3. Load all chunks from PostgreSQL
      4. Mark chunks as 'embedding'
      5. Build enriched chunk dicts (includes original_filename for citations)
      6. Generate embeddings in batches (threadpool — non-blocking)
      7. Upsert into Qdrant with rich metadata payload (threadpool)
      8. Mark chunks as 'embedded' with timestamp
      9. Return summary stats

    Args:
        db:       Async SQLAlchemy session
        document: Document ORM object (must be processing_status='processed')
        force:    If True, re-embed even if already embedded (re-index)

    Returns:
        dict: chunk_count, vector_dim, model_name, processing_time_seconds,
              skipped (bool if duplicate was detected)
    """
    start_time = time.monotonic()

    # ── Stage 1: Guard ─────────────────────────────────────────────────────
    if document.processing_status != "processed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Document must be in 'processed' state before embedding. "
                f"Current status: '{document.processing_status}'. "
                f"Call POST /documents/{document.id}/process first."
            ),
        )

    logger.info(
        "[EmbedPipeline] Starting — doc_id=%d filename='%s'",
        document.id, document.original_filename,
    )

    # ── Stage 2: Load chunks ───────────────────────────────────────────────
    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
    )
    chunks: list[DocumentChunk] = list(result.scalars().all())

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document has no chunks. Run POST /process first.",
        )

    # ── Stage 3: Duplicate prevention ─────────────────────────────────────
    # Only skip if all chunks are marked as 'embedded' in PostgreSQL AND they actually exist in Qdrant
    if not force:
        already_embedded = [c for c in chunks if c.embedding_status == "embedded"]
        has_vectors = vector_store.has_document_vectors(document.id)
        if len(already_embedded) == len(chunks) and has_vectors:
            elapsed = time.monotonic() - start_time
            logger.info(
                "[EmbedPipeline] Duplicate skipped — doc_id=%d all %d chunks already embedded.",
                document.id, len(chunks),
            )
            return {
                "chunk_count":             len(chunks),
                "vector_dim":              embedding_service.vector_dim,
                "model_name":              embedding_service.model_name,
                "processing_time_seconds": round(elapsed, 3),
                "skipped":                 True,
                "skip_reason":             "All chunks already embedded. Pass force=true to re-index.",
            }

    # ── Stage 4: Mark chunks as 'embedding' ───────────────────────────────
    await db.execute(
        update(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
        .values(embedding_status="embedding")
    )
    await db.commit()
    logger.info(
        "[EmbedPipeline] Marked %d chunks as 'embedding' — doc_id=%d",
        len(chunks), document.id,
    )

    try:
        # ── Stage 5: Build enriched chunk dicts ───────────────────────────
        chunk_dicts = [
            {
                "id":                    c.id,
                "document_id":           c.document_id,
                "page_number":           c.page_number,
                "chunk_index":           c.chunk_index,
                "content":               c.content,
                "character_count":       c.character_count,
                "estimated_token_count": c.estimated_token_count,
                # ── Citation metadata for Qdrant payload ──────────────
                "original_filename":     document.original_filename,
            }
            for c in chunks
        ]

        # ── Stage 6: Generate embeddings (CPU → threadpool) ───────────────
        texts = [c.content for c in chunks]
        loop  = asyncio.get_event_loop()

        from app.core.config import settings as _settings
        batch_size = _settings.EMBEDDING_BATCH_SIZE

        embed_fn  = partial(embedding_service.embed_many, texts, batch_size)
        vectors: list[list[float]] = await loop.run_in_executor(None, embed_fn)

        logger.info(
            "[EmbedPipeline] Generated %d embeddings (dim=%d) for doc_id=%d",
            len(vectors), embedding_service.vector_dim, document.id,
        )

        # ── Stage 7: Upsert into Qdrant (I/O → threadpool) ───────────────
        upsert_fn = partial(vector_store.upsert_chunks, chunk_dicts, vectors)
        upserted  = await loop.run_in_executor(None, upsert_fn)

        logger.info(
            "[EmbedPipeline] Upserted %d vectors into Qdrant for doc_id=%d",
            upserted, document.id,
        )

        # ── Stage 8: Mark chunks as 'embedded' ───────────────────────────
        now = datetime.datetime.now(datetime.timezone.utc)
        await db.execute(
            update(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
            .values(embedding_status="embedded", embedded_at=now)
        )
        await db.commit()

        elapsed = time.monotonic() - start_time
        logger.info(
            "[EmbedPipeline] COMPLETE — doc_id=%d chunks=%d dim=%d time=%.2fs",
            document.id, len(chunks), embedding_service.vector_dim, elapsed,
        )

        return {
            "chunk_count":             len(chunks),
            "vector_dim":              embedding_service.vector_dim,
            "model_name":              embedding_service.model_name,
            "processing_time_seconds": round(elapsed, 3),
            "skipped":                 False,
        }

    except HTTPException:
        raise

    except Exception as exc:
        # ── Mark all chunks as failed ──────────────────────────────────────
        await db.execute(
            update(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
            .values(embedding_status="failed")
        )
        await db.commit()
        logger.error(
            "[EmbedPipeline] FAILED — doc_id=%d error=%s", document.id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding pipeline failed: {exc}",
        )


async def get_embedding_status(db: AsyncSession, document_id: int) -> dict:
    """
    Return detailed embedding statistics for a document.

    Returns:
        {total, embedded, pending, failed, is_complete, last_embedded_at}
    """
    result = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    chunks = list(result.scalars().all())

    if not chunks:
        return {
            "total":           0,
            "embedded":        0,
            "pending":         0,
            "failed":          0,
            "is_complete":     False,
            "last_embedded_at": None,
        }

    counts: dict[str, int] = {"pending": 0, "embedding": 0, "embedded": 0, "failed": 0}
    for c in chunks:
        counts[c.embedding_status] = counts.get(c.embedding_status, 0) + 1

    # Find the most recent embedded_at timestamp
    embedded_timestamps = [c.embedded_at for c in chunks if c.embedded_at is not None]
    last_embedded_at = max(embedded_timestamps).isoformat() if embedded_timestamps else None

    total     = len(chunks)
    embedded  = counts["embedded"]
    pending   = counts["pending"] + counts["embedding"]
    failed    = counts["failed"]

    # If database marks it as embedded, verify Qdrant actually has the vectors (wiped in-memory on restart)
    has_vectors = vector_store.has_document_vectors(document_id)
    if not has_vectors and embedded > 0:
        embedded = 0
        pending = total
        is_complete = False
    else:
        is_complete = total > 0 and embedded == total

    return {
        "total":            total,
        "embedded":         embedded,
        "pending":          pending,
        "failed":           failed,
        "is_complete":      is_complete,
        "last_embedded_at": last_embedded_at,
    }
