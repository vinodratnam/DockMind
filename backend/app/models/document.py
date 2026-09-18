"""
Document ORM model.

Stores metadata about uploaded files. Actual file bytes are written to disk
under backend/storage/uploads/ using a UUID-based filename.
"""
import datetime
import enum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ProcessingStatus(str, enum.Enum):
    uploaded   = "uploaded"
    processing = "processing"
    processed  = "processed"
    failed     = "failed"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Legacy column — kept nullable for backward compat; use original_filename instead
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Original name as uploaded by the user
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)

    # UUID-based name stored on disk (e.g. "2f7b34c1-…-uuid4.pdf")
    stored_filename: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)

    # Absolute path to the file on disk
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)

    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)   # bytes
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # ── Processing pipeline fields ──────────────────────────────────────
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="uploaded",
    )
    page_count:    Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_count:   Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_at:  Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    processing_error: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    owner:  Mapped["User"] = relationship("User", back_populates="documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Document id={self.id} original={self.original_filename!r} status={self.processing_status!r}>"
