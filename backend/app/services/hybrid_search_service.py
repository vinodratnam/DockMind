"""
Hybrid Search Service — BM25 + Semantic Search with Reciprocal Rank Fusion.

Why hybrid search?
  - Semantic search (dense vectors) excels at paraphrase / concept matching
  - BM25 (keyword) excels at exact term matching (e.g. "Section 4.2", product codes)
  - RRF combines ranked lists without needing score normalization

Pipeline:
  1. Run semantic search (Qdrant) → ranked list A
  2. Run BM25 on chunk texts → ranked list B
  3. Merge with RRF formula: score(d) = Σ 1/(k + rank(d))
  4. Return top-K deduplicated chunks

RRF constant k=60 is the standard value (Cormack et al. 2009).
"""
import logging
import math
import re
from typing import Optional

logger = logging.getLogger(__name__)

# RRF rank fusion constant — higher = smoother blend, lower = more rank-sensitive
RRF_K = 60


def _tokenize(text: str) -> list[str]:
    """Simple whitespace + lowercase tokenizer for BM25."""
    return re.findall(r"[a-z0-9]+", text.lower())


def bm25_search(
    query: str,
    corpus_chunks: list[dict],
    top_k: int = 10,
) -> list[dict]:
    """
    Run BM25 keyword search over a list of chunk dicts.

    Args:
        query:         User's question string.
        corpus_chunks: List of chunk dicts with 'content' field.
        top_k:         Number of top results to return.

    Returns:
        Ranked list of chunk dicts enriched with 'bm25_score' field.
    """
    if not corpus_chunks:
        return []

    try:
        from rank_bm25 import BM25Okapi
    except ImportError:
        logger.warning("[HybridSearch] rank_bm25 not installed — skipping BM25 stage")
        return []

    tokenized_corpus = [_tokenize(c.get("content", "")) for c in corpus_chunks]
    bm25 = BM25Okapi(tokenized_corpus)

    tokenized_query = _tokenize(query)
    scores = bm25.get_scores(tokenized_query)

    # Pair chunks with their BM25 scores
    ranked = sorted(
        zip(corpus_chunks, scores),
        key=lambda x: x[1],
        reverse=True,
    )

    results = []
    for chunk, score in ranked[:top_k]:
        results.append({**chunk, "bm25_score": float(score)})

    return results


def reciprocal_rank_fusion(
    semantic_chunks: list[dict],
    bm25_chunks: list[dict],
    k: int = RRF_K,
    top_k: int = 10,
) -> list[dict]:
    """
    Merge two ranked lists of chunks using Reciprocal Rank Fusion.

    Args:
        semantic_chunks: Ranked by vector similarity (index 0 = best).
        bm25_chunks:     Ranked by BM25 score (index 0 = best).
        k:               RRF smoothing constant (default=60).
        top_k:           Number of final results to return.

    Returns:
        Merged, re-ranked list of chunk dicts with 'rrf_score' field.
    """
    rrf_scores: dict[str, float] = {}
    chunk_map: dict[str, dict] = {}

    def _chunk_key(c: dict) -> str:
        """Unique identifier for a chunk."""
        return str(c.get("chunk_id") or f"{c.get('document_id')}_{c.get('chunk_index')}")

    # Apply RRF from semantic list
    for rank, chunk in enumerate(semantic_chunks, start=1):
        key = _chunk_key(chunk)
        rrf_scores[key] = rrf_scores.get(key, 0.0) + 1.0 / (k + rank)
        chunk_map[key] = chunk

    # Apply RRF from BM25 list
    for rank, chunk in enumerate(bm25_chunks, start=1):
        key = _chunk_key(chunk)
        rrf_scores[key] = rrf_scores.get(key, 0.0) + 1.0 / (k + rank)
        if key not in chunk_map:
            chunk_map[key] = chunk

    # Sort by RRF score
    sorted_keys = sorted(rrf_scores.keys(), key=lambda k: rrf_scores[k], reverse=True)

    merged = []
    for key in sorted_keys[:top_k]:
        chunk = dict(chunk_map[key])
        chunk["rrf_score"] = round(rrf_scores[key], 6)
        # Use RRF score as the main 'score' for downstream compatibility
        chunk["score"] = chunk["rrf_score"]
        merged.append(chunk)

    return merged


def hybrid_search(
    query: str,
    semantic_results: list[dict],
    corpus_chunks: list[dict],
    top_k: int = 10,
) -> list[dict]:
    """
    Full hybrid search combining semantic + BM25 via RRF.

    Args:
        query:            User's question.
        semantic_results: Pre-ranked semantic search results from Qdrant.
        corpus_chunks:    All available chunks for BM25 (same pool as semantic).
        top_k:            Number of final results to return.

    Returns:
        Merged ranked list of chunk dicts.
    """
    if not corpus_chunks:
        return semantic_results[:top_k]

    logger.info(
        "[HybridSearch] Running BM25 over %d chunks for query=%r",
        len(corpus_chunks), query[:50],
    )

    bm25_results = bm25_search(query, corpus_chunks, top_k=top_k)
    merged = reciprocal_rank_fusion(semantic_results, bm25_results, top_k=top_k)

    logger.info(
        "[HybridSearch] RRF merged %d semantic + %d BM25 → %d results",
        len(semantic_results), len(bm25_results), len(merged),
    )
    return merged
