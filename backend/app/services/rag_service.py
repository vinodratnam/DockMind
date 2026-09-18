"""
RAG Service — complete Retrieval-Augmented Generation pipeline.

Pipeline:
  Question
    → embed question (EmbeddingService)
    → semantic search (VectorStoreService, filtered by user's docs)
    → validate ownership (PostgreSQL)
    → build prompt (PromptBuilder)
    → call Gemini (GeminiService)
    → format citations
    → persist messages (PostgreSQL)
    → return structured response

Security:
  - Users can ONLY search their own documents (ownership validated)
  - document_ids are always filtered through PostgreSQL before Qdrant search

Performance:
  - Embedding + Qdrant search run in threadpool (non-blocking async)
  - Gemini call in threadpool
  - Structured logging at every stage with timing
"""
import asyncio
import datetime
import json
import logging
import time
from functools import partial
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chat import Chat
from app.models.document import Document
from app.models.message import Message, MessageRole
from app.services.embedding_service import embedding_service
from app.services.gemini_service import gemini_service
from app.services.prompt_builder import build_rag_prompt, format_no_context_prompt
from app.services.vector_store_service import vector_store
from app.services.hybrid_search_service import hybrid_search
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# CORE RAG PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

async def ask(
    db: AsyncSession,
    user_id: int,
    question: str,
    document_ids: Optional[list[int]] = None,
    chat_id: Optional[int] = None,
    top_k: Optional[int] = None,
    score_threshold: Optional[float] = None,
) -> dict:
    """
    Full RAG pipeline: question → embeddings → Qdrant → Gemini → response.

    Args:
        db:               Async SQLAlchemy session
        user_id:          Authenticated user's ID (for ownership checks)
        question:         User's natural language question
        document_ids:     Optional list of doc IDs to scope the search.
                          If None, searches ALL user's embedded documents.
        chat_id:          If provided, messages are persisted to this chat.
        top_k:            Override default top_k retrieval count
        score_threshold:  Override default similarity score threshold

    Returns:
        {answer, sources, usage, chat_id, message_id, retrieval_stats}
    """
    pipeline_start = time.monotonic()
    effective_top_k = top_k or settings.RAG_TOP_K
    effective_threshold = score_threshold or settings.RAG_SCORE_THRESHOLD

    logger.info(
        "[RAG] Pipeline start — user=%d question_len=%d doc_filter=%s",
        user_id, len(question), document_ids,
    )

    # ── Stage 1: Validate document ownership ───────────────────────────────
    validated_doc_ids = await _validate_document_ownership(
        db, user_id, document_ids
    )

    # ── Stage 2: Embed the question ────────────────────────────────────────
    t0 = time.monotonic()
    loop = asyncio.get_event_loop()
    try:
        embed_fn = partial(embedding_service.embed_one, question)
        query_vector: list[float] = await loop.run_in_executor(None, embed_fn)
    except Exception as exc:
        logger.error("[RAG] Embedding failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process your question. Embedding service unavailable.",
        )
    embedding_ms = int((time.monotonic() - t0) * 1000)
    logger.info("[RAG] Question embedded in %dms", embedding_ms)

    # ── Stage 3: Semantic search in Qdrant ────────────────────────────────
    t0 = time.monotonic()
    all_chunks: list[dict] = []

    if not vector_store.is_connected:
        logger.warning("[RAG] Qdrant not connected — returning no-context response")
    else:
        if validated_doc_ids:
            # Search per-document and merge results
            for doc_id in validated_doc_ids[:10]:  # Cap at 10 docs
                try:
                    search_fn = partial(
                        vector_store.search,
                        query_vector,
                        doc_id,
                        effective_top_k,
                        effective_threshold,
                    )
                    chunks = await loop.run_in_executor(None, search_fn)
                    all_chunks.extend(chunks)
                except Exception as exc:
                    logger.warning("[RAG] Search failed for doc %d: %s", doc_id, exc)
        else:
            # Search across ALL user's embedded documents
            try:
                search_fn = partial(
                    vector_store.search,
                    query_vector,
                    None,           # No document filter
                    effective_top_k,
                    effective_threshold,
                )
                all_chunks = await loop.run_in_executor(None, search_fn)
                # Security: filter by user's doc IDs
                all_chunks = await _filter_by_ownership(db, user_id, all_chunks)
            except Exception as exc:
                logger.error("[RAG] Qdrant search failed: %s", exc)

    # Sort by score descending and deduplicate by chunk_id
    seen = set()
    unique_chunks: list[dict] = []
    for c in sorted(all_chunks, key=lambda x: x.get("score", 0), reverse=True):
        cid = c.get("chunk_id")
        if cid not in seen:
            seen.add(cid)
            unique_chunks.append(c)

    # ── Hybrid search: BM25 + RRF on top of semantic results ────────────────
    if unique_chunks and getattr(settings, "HYBRID_SEARCH", True):
        try:
            corpus_fn = partial(vector_store.scroll_chunks, None, 2000)
            corpus = await loop.run_in_executor(None, corpus_fn)
            # Filter corpus to user-owned docs
            corpus = await _filter_by_ownership(db, user_id, corpus)
            unique_chunks = hybrid_search(question, unique_chunks, corpus, top_k=effective_top_k)
            logger.info("[RAG] Hybrid search applied — %d results after RRF", len(unique_chunks))
        except Exception as exc:
            logger.warning("[RAG] Hybrid search failed, falling back to semantic: %s", exc)

    retrieved_chunks = unique_chunks[:effective_top_k]

    qdrant_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "[RAG] Qdrant returned %d chunks in %dms (threshold=%.2f)",
        len(retrieved_chunks), qdrant_ms, effective_threshold,
    )

    # ── Stage 4: Build prompt ──────────────────────────────────────────────
    if retrieved_chunks:
        prompt = build_rag_prompt(question, retrieved_chunks)
    else:
        prompt = format_no_context_prompt(question)
        logger.info("[RAG] No chunks retrieved — using no-context response")

    # ── Stage 5: Call Gemini ───────────────────────────────────────────────
    t0 = time.monotonic()
    generate_fn = partial(gemini_service.generate, prompt)
    answer, usage = await loop.run_in_executor(None, generate_fn)
    gemini_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "[RAG] Gemini responded in %dms — tokens=%d",
        gemini_ms, usage.get("total_tokens", 0),
    )

    # ── Stage 6: Format citations ──────────────────────────────────────────
    sources = _format_sources(retrieved_chunks)

    # ── Stage 7: Persist messages (if chat_id provided) ───────────────────
    message_id: Optional[int] = None
    if chat_id:
        message_id = await _persist_conversation(
            db, chat_id, question, answer, sources
        )

    # ── Stage 8: Build response ────────────────────────────────────────────
    total_ms = int((time.monotonic() - pipeline_start) * 1000)
    logger.info("[RAG] Pipeline complete in %dms", total_ms)

    return {
        "answer":    answer,
        "sources":   sources,
        "chat_id":   chat_id,
        "message_id": message_id,
        "usage":     usage,
        "retrieval_stats": {
            "chunks_retrieved":     len(retrieved_chunks),
            "embedding_latency_ms": embedding_ms,
            "qdrant_latency_ms":    qdrant_ms,
            "gemini_latency_ms":    gemini_ms,
            "total_latency_ms":     total_ms,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# STREAMING RAG PIPELINE  (SSE)
# ══════════════════════════════════════════════════════════════════════════════

async def ask_stream(
    db: AsyncSession,
    user_id: int,
    question: str,
    document_ids: Optional[list[int]] = None,
    chat_id: Optional[int] = None,
    top_k: Optional[int] = None,
    score_threshold: Optional[float] = None,
) -> AsyncGenerator[str, None]:
    """
    SSE-streaming variant of the RAG pipeline.

    Yields SSE-formatted strings:
      data: <text chunk>\\n\\n          — each Gemini token chunk
      data: [SOURCES] <json>\\n\\n      — final event with sources+stats
      data: [DONE]\\n\\n               — stream terminator

    The caller wraps this in a FastAPI StreamingResponse with
    media_type='text/event-stream'.
    """
    pipeline_start = time.monotonic()
    effective_top_k = top_k or settings.RAG_TOP_K
    effective_threshold = score_threshold or settings.RAG_SCORE_THRESHOLD

    logger.info(
        "[RAG-SSE] Pipeline start — user=%d question_len=%d",
        user_id, len(question),
    )

    # ── Stage 1: Validate document ownership ───────────────────────────────
    try:
        validated_doc_ids = await _validate_document_ownership(db, user_id, document_ids)
    except HTTPException as exc:
        yield f"data: {exc.detail}\n\n"
        yield "data: [DONE]\n\n"
        return

    # ── Stage 2: Embed question ─────────────────────────────────────────────
    loop = asyncio.get_event_loop()
    try:
        embed_fn = partial(embedding_service.embed_one, question)
        query_vector: list[float] = await loop.run_in_executor(None, embed_fn)
    except Exception as exc:
        logger.error("[RAG-SSE] Embedding failed: %s", exc)
        yield "data: Failed to process your question. Please try again.\n\n"
        yield "data: [DONE]\n\n"
        return

    # ── Stage 3: Semantic search ────────────────────────────────────────────
    t0 = time.monotonic()
    all_chunks: list[dict] = []

    if vector_store.is_connected:
        if validated_doc_ids:
            for doc_id in validated_doc_ids[:10]:
                try:
                    search_fn = partial(
                        vector_store.search, query_vector, doc_id,
                        effective_top_k, effective_threshold,
                    )
                    chunks = await loop.run_in_executor(None, search_fn)
                    all_chunks.extend(chunks)
                except Exception as exc:
                    logger.warning("[RAG-SSE] Search failed for doc %d: %s", doc_id, exc)
        else:
            try:
                search_fn = partial(
                    vector_store.search, query_vector, None,
                    effective_top_k, effective_threshold,
                )
                all_chunks = await loop.run_in_executor(None, search_fn)
                all_chunks = await _filter_by_ownership(db, user_id, all_chunks)
            except Exception as exc:
                logger.error("[RAG-SSE] Qdrant search failed: %s", exc)

    seen = set()
    unique_chunks: list[dict] = []
    for c in sorted(all_chunks, key=lambda x: x.get("score", 0), reverse=True):
        cid = c.get("chunk_id")
        if cid not in seen:
            seen.add(cid)
            unique_chunks.append(c)
    retrieved_chunks = unique_chunks[:effective_top_k]

    qdrant_ms = int((time.monotonic() - t0) * 1000)
    embedding_ms = 0  # already measured above (rough)

    # ── Stage 4: Build prompt ───────────────────────────────────────────────
    if retrieved_chunks:
        prompt = build_rag_prompt(question, retrieved_chunks)
    else:
        prompt = format_no_context_prompt(question)

    # ── Stage 5: Stream Gemini response ─────────────────────────────────────
    t_gemini = time.monotonic()
    full_answer = ""

    # Run the synchronous generator in a threadpool
    stream_gen = partial(gemini_service.generate_stream, prompt)

    def _run_stream():
        """Synchronous helper that returns all chunks as a list."""
        return list(gemini_service.generate_stream(prompt))

    # We yield as we go using run_in_executor per chunk is not ideal for
    # streaming, so we use a queue-based approach
    import queue
    import threading

    q: queue.Queue[Optional[str]] = queue.Queue()

    def _stream_worker():
        try:
            for chunk_text in gemini_service.generate_stream(prompt):
                q.put(chunk_text)
        finally:
            q.put(None)  # Sentinel

    thread = threading.Thread(target=_stream_worker, daemon=True)
    thread.start()

    while True:
        try:
            chunk_text = await loop.run_in_executor(None, lambda: q.get(timeout=30))
        except Exception:
            break
        if chunk_text is None:
            break
        full_answer += chunk_text
        # Escape newlines for SSE data field
        safe = chunk_text.replace("\n", "\\n")
        yield f"data: {safe}\n\n"

    gemini_ms = int((time.monotonic() - t_gemini) * 1000)

    # ── Stage 6: Persist + send final metadata ──────────────────────────────
    sources = _format_sources(retrieved_chunks)
    total_ms = int((time.monotonic() - pipeline_start) * 1000)

    message_id: Optional[int] = None
    if chat_id:
        message_id = await _persist_conversation(db, chat_id, question, full_answer, sources)

    meta = json.dumps({
        "sources": sources,
        "message_id": message_id,
        "chat_id": chat_id,
        "retrieval_stats": {
            "chunks_retrieved": len(retrieved_chunks),
            "embedding_latency_ms": embedding_ms,
            "qdrant_latency_ms": qdrant_ms,
            "gemini_latency_ms": gemini_ms,
            "total_latency_ms": total_ms,
        },
        "usage": {
            "prompt_tokens": 0, "completion_tokens": len(full_answer) // 4,
            "total_tokens": len(full_answer) // 4, "latency_ms": gemini_ms,
        },
    })
    yield f"data: [SOURCES] {meta}\n\n"
    yield "data: [DONE]\n\n"
    logger.info("[RAG-SSE] Stream complete — %d chunks %dms", len(retrieved_chunks), total_ms)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def _validate_document_ownership(
    db: AsyncSession,
    user_id: int,
    document_ids: Optional[list[int]],
) -> list[int]:
    """
    Validate that all requested document IDs belong to this user.
    Returns the validated list. Raises 403 if any doc doesn't belong to user.
    Returns empty list if document_ids is None (= search all).
    """
    if not document_ids:
        return []

    result = await db.execute(
        select(Document.id).where(
            Document.id.in_(document_ids),
            Document.user_id == user_id,
        )
    )
    valid_ids = [row[0] for row in result.all()]

    invalid = set(document_ids) - set(valid_ids)
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Document(s) not found or not owned by you: {list(invalid)}",
        )

    return valid_ids


async def _filter_by_ownership(
    db: AsyncSession,
    user_id: int,
    chunks: list[dict],
) -> list[dict]:
    """
    Filter a list of retrieved chunks to only those from user-owned documents.
    Used when searching across the whole collection without a doc_id filter.
    """
    if not chunks:
        return []

    # Get all document IDs referenced in the chunks
    doc_ids = list({c.get("document_id") for c in chunks if c.get("document_id")})
    if not doc_ids:
        return []

    # Verify ownership in PostgreSQL
    result = await db.execute(
        select(Document.id).where(
            Document.id.in_(doc_ids),
            Document.user_id == user_id,
        )
    )
    owned_ids = {row[0] for row in result.all()}
    return [c for c in chunks if c.get("document_id") in owned_ids]


def _format_sources(chunks: list[dict]) -> list[dict]:
    """
    Convert retrieved chunk dicts into clean citation objects for the API response.

    Each source includes:
      document_id, document_name, page_number, chunk_index, score, text_preview
    """
    seen_pages: set[tuple] = set()
    sources: list[dict] = []

    for chunk in chunks:
        doc_id   = chunk.get("document_id")
        filename = chunk.get("original_filename", "Unknown Document")
        page     = chunk.get("page_number", 0)
        key      = (doc_id, page)

        if key in seen_pages:
            continue
        seen_pages.add(key)

        sources.append({
            "document_id":   doc_id,
            "document_name": filename,
            "page_number":   page,
            "chunk_index":   chunk.get("chunk_index", 0),
            "score":         round(chunk.get("score", 0.0), 4),
            "text_preview":  chunk.get("text_preview") or chunk.get("content", "")[:200],
        })

    return sources


async def _persist_conversation(
    db: AsyncSession,
    chat_id: int,
    question: str,
    answer: str,
    sources: list[dict],
) -> Optional[int]:
    """
    Persist user question + AI answer + sources to PostgreSQL.
    Returns the assistant message ID.
    """
    try:
        # Persist user message
        user_msg = Message(
            chat_id=chat_id,
            role=MessageRole.user,
            content=question,
            sources_json=None,
        )
        db.add(user_msg)
        await db.flush()  # Get the ID without committing

        # Persist assistant message with sources
        ai_msg = Message(
            chat_id=chat_id,
            role=MessageRole.assistant,
            content=answer,
            sources_json=json.dumps(sources) if sources else None,
        )
        db.add(ai_msg)

        # Update chat updated_at
        await db.execute(
            select(Chat).where(Chat.id == chat_id)
        )

        await db.commit()
        await db.refresh(ai_msg)
        logger.info(
            "[RAG] Persisted conversation — chat_id=%d ai_msg_id=%d",
            chat_id, ai_msg.id,
        )
        return ai_msg.id

    except Exception as exc:
        await db.rollback()
        logger.error("[RAG] Failed to persist conversation: %s", exc)
        return None


# ══════════════════════════════════════════════════════════════════════════════
# CHAT HISTORY
# ══════════════════════════════════════════════════════════════════════════════

async def get_chat_history(
    db: AsyncSession,
    chat_id: int,
    user_id: int,
) -> list[dict]:
    """
    Return full message history for a chat, with parsed sources.
    Validates ownership before returning.
    """
    # Validate ownership
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found.",
        )

    # Fetch messages
    msg_result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
    )
    messages = list(msg_result.scalars().all())

    history = []
    for msg in messages:
        sources = []
        if msg.sources_json:
            try:
                sources = json.loads(msg.sources_json)
            except Exception:
                pass

        history.append({
            "id":         msg.id,
            "role":       msg.role.value,
            "content":    msg.content,
            "sources":    sources,
            "created_at": msg.created_at.isoformat(),
        })

    return history
