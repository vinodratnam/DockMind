"""
Pydantic schemas for chat messages and RAG API.
"""
import datetime
from typing import Optional

from pydantic import BaseModel, Field
from app.models.message import MessageRole


# ── Message read/create ───────────────────────────────────────────────────

class MessageCreate(BaseModel):
    role: MessageRole
    content: str


class SourceRead(BaseModel):
    """A single citation from the RAG pipeline."""
    document_id:   Optional[int]  = None
    document_name: str
    page_number:   int
    chunk_index:   int
    score:         float
    text_preview:  str

    model_config = {"from_attributes": True}


class MessageRead(BaseModel):
    id: int
    chat_id: int
    role: MessageRole
    content: str
    sources: list[SourceRead] = Field(default_factory=list)
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ── RAG request/response ──────────────────────────────────────────────────

class AskRequest(BaseModel):
    """Request body for POST /chats/ask"""
    question:     str = Field(..., min_length=1, max_length=2000,
                              description="The user's natural language question")
    document_ids: Optional[list[int]] = Field(
        default=None,
        description="Limit search to these document IDs. None = search all user's documents."
    )
    chat_id:      Optional[int] = Field(
        default=None,
        description="Persist conversation to this chat session. None = ephemeral."
    )
    top_k:            Optional[int]   = Field(default=None, ge=1, le=20)
    score_threshold:  Optional[float] = Field(default=None, ge=0.0, le=1.0)


class RetrievalStats(BaseModel):
    chunks_retrieved:     int
    embedding_latency_ms: int
    qdrant_latency_ms:    int
    gemini_latency_ms:    int
    total_latency_ms:     int


class UsageStats(BaseModel):
    prompt_tokens:     int = 0
    completion_tokens: int = 0
    total_tokens:      int = 0
    latency_ms:        int = 0


class AskResponse(BaseModel):
    """Response from POST /chats/ask"""
    answer:          str
    sources:         list[SourceRead]
    chat_id:         Optional[int]   = None
    message_id:      Optional[int]   = None
    usage:           UsageStats
    retrieval_stats: RetrievalStats
