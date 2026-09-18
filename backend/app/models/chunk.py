"""
DocumentChunk ORM model.

Each Document is split into overlapping text chunks after PDF processing.
Chunks are the atomic unit for embedding and semantic search.
Embedding status tracks whether each chunk has been indexed in Qdrant.
"""
import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    page_number:  Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    chunk_index:  Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    content:      Mapped[str] = mapped_column(Text, nullable=False)

    character_count:       Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_token_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Embedding / Vector indexing fields ─────────────────────────────────
    embedding_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="pending",
    )  # pending | embedding | embedded | failed

    embedded_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship back to Document
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return (
            f"<DocumentChunk doc={self.document_id} "
            f"page={self.page_number} idx={self.chunk_index} "
            f"embed={self.embedding_status}>"
        )
