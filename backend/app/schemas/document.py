"""
Pydantic schemas for documents, chunks, processing, embeddings, and vector store.
"""
import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ── Status literals ───────────────────────────────────────────────────────
ProcessingStatusLiteral = Literal["uploaded", "processing", "processed", "failed"]
EmbeddingStatusLiteral  = Literal["pending", "embedding", "embedded", "failed"]


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENT
# ══════════════════════════════════════════════════════════════════════════════

class DocumentRead(BaseModel):
    """Full document metadata returned from API."""
    id: int
    user_id: int
    original_filename: str
    stored_filename: str
    file_path: str
    file_size: int | None
    mime_type: str | None
    # Processing pipeline
    processing_status: str
    page_count:        int | None
    chunk_count:       int | None
    processed_at:      datetime.datetime | None
    processing_error:  str | None
    created_at:        datetime.datetime
    updated_at:        datetime.datetime

    model_config = {"from_attributes": True}


class DocumentDeleteResponse(BaseModel):
    message:      str
    document_id:  int


# ══════════════════════════════════════════════════════════════════════════════
# CHUNK
# ══════════════════════════════════════════════════════════════════════════════

class ChunkRead(BaseModel):
    """Schema for a single extracted + (optionally) embedded text chunk."""
    id: int
    document_id: int
    page_number: int
    chunk_index: int
    content: str
    character_count: int
    estimated_token_count: int
    embedding_status: str
    embedded_at: datetime.datetime | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# PROCESSING
# ══════════════════════════════════════════════════════════════════════════════

class ProcessResponse(BaseModel):
    document_id:             int
    status:                  str
    page_count:              int
    chunk_count:             int
    processing_time_seconds: float


# ══════════════════════════════════════════════════════════════════════════════
# EMBEDDING
# ══════════════════════════════════════════════════════════════════════════════

class EmbedResponse(BaseModel):
    """Returned after embedding pipeline completes (or is skipped)."""
    document_id:             int
    chunk_count:             int
    vector_dim:              int
    model_name:              str
    processing_time_seconds: float
    status:                  str = "embedded"
    skipped:                 bool = False
    skip_reason:             Optional[str] = None

    model_config = {"protected_namespaces": ()}


class EmbeddingStatusResponse(BaseModel):
    """Detailed embedding progress for a document."""
    document_id:      int
    total:            int
    embedded:         int
    pending:          int
    failed:           int
    is_complete:      bool
    last_embedded_at: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# VECTOR STORE HEALTH
# ══════════════════════════════════════════════════════════════════════════════

class VectorStoreHealth(BaseModel):
    """Rich health report from Qdrant collection."""
    connected:          bool
    collection:         Optional[str]  = None
    vector_dimension:   Optional[int]  = None
    distance_metric:    Optional[str]  = None
    embedding_model:    Optional[str]  = None
    vector_count:       Optional[int]  = None
    collection_status:  Optional[str]  = None
    qdrant_mode:        Optional[str]  = None
    error:              Optional[str]  = None


# ══════════════════════════════════════════════════════════════════════════════
# STARTUP VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

class StartupValidation(BaseModel):
    """Result of post-startup system validation."""
    all_ok:           bool
    issues:           list[str]
    embedding_loaded: bool
    qdrant_connected: bool
    vector_dim:       Optional[int] = None
