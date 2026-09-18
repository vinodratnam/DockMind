"""
Pydantic schemas for chat sessions.
"""
import datetime
from typing import Optional

from pydantic import BaseModel


class ChatCreate(BaseModel):
    title: str = "New Chat"


class ChatRead(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class ChatUpdate(BaseModel):
    title: Optional[str] = None


class ReferencedDoc(BaseModel):
    document_name: str
    count: int


class ChatStats(BaseModel):
    questions_asked: int
    avg_response_time_ms: int
    retrieved_chunks: int
    embedding_model: str
    llm_model: str
    token_usage: int
    most_referenced_docs: list[ReferencedDoc]

