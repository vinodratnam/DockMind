"""
PDF Processing Pipeline — schema additions.

Revision ID: 004
Changes:
  - documents: add processing_status, page_count, chunk_count, processed_at, processing_error
  - NEW TABLE: document_chunks
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── documents: add processing pipeline columns ─────────────────────────
    op.add_column(
        "documents",
        sa.Column(
            "processing_status",
            sa.String(length=20),
            nullable=False,
            server_default="uploaded",
        ),
    )
    op.add_column(
        "documents",
        sa.Column("page_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("chunk_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("processing_error", sa.String(length=1024), nullable=True),
    )

    # ── document_chunks table ──────────────────────────────────────────────
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("character_count", sa.Integer(), nullable=False),
        sa.Column("estimated_token_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_chunks_page_number",  "document_chunks", ["page_number"])
    op.create_index("ix_chunks_chunk_index",   "document_chunks", ["chunk_index"])


def downgrade() -> None:
    op.drop_index("ix_chunks_chunk_index",   table_name="document_chunks")
    op.drop_index("ix_chunks_page_number",   table_name="document_chunks")
    op.drop_index("ix_chunks_document_id",   table_name="document_chunks")
    op.drop_table("document_chunks")

    op.drop_column("documents", "processing_error")
    op.drop_column("documents", "processed_at")
    op.drop_column("documents", "chunk_count")
    op.drop_column("documents", "page_count")
    op.drop_column("documents", "processing_status")
