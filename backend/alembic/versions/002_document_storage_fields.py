"""
Document storage fields migration.

Revision ID: 002
Adds: original_filename, stored_filename, updated_at to documents table.
Renames the old 'filename' column to 'original_filename' equivalent via new columns.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add original_filename (copy existing filename data in)
    op.add_column(
        "documents",
        sa.Column("original_filename", sa.String(length=512), nullable=True),
    )
    # Add stored_filename (UUID-based filename on disk)
    op.add_column(
        "documents",
        sa.Column("stored_filename", sa.String(length=512), nullable=True),
    )
    # Add updated_at timestamp
    op.add_column(
        "documents",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
    )

    # Backfill: copy existing filename → original_filename, stored_filename
    op.execute("UPDATE documents SET original_filename = filename, stored_filename = filename")
    op.execute("UPDATE documents SET updated_at = created_at WHERE updated_at IS NULL")

    # Now make the new columns NOT NULL (data is populated)
    op.alter_column("documents", "original_filename", nullable=False)
    op.alter_column("documents", "stored_filename", nullable=False)
    op.alter_column("documents", "updated_at", nullable=False)

    # Add unique constraint on stored_filename
    op.create_unique_constraint("uq_documents_stored_filename", "documents", ["stored_filename"])


def downgrade() -> None:
    op.drop_constraint("uq_documents_stored_filename", "documents", type_="unique")
    op.drop_column("documents", "updated_at")
    op.drop_column("documents", "stored_filename")
    op.drop_column("documents", "original_filename")
