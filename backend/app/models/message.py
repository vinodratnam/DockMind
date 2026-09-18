"""
Message ORM model — updated for RAG pipeline.

Stores individual turns within a Chat. The `role` field follows the
OpenAI-compatible convention ('user' | 'assistant' | 'system').
The `sources_json` column stores citation metadata for assistant messages
as a JSON string: list[{document_id, document_name, page_number, score, ...}]
"""
import datetime
import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # RAG citations — stored as JSON string (nullable for user messages)
    sources_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship back to Chat
    chat: Mapped["Chat"] = relationship("Chat", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message id={self.id} role={self.role} chat_id={self.chat_id}>"
