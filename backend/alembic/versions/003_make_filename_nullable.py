"""
Make legacy filename column nullable.

Revision ID: 003
The original 'filename' column from migration 001 is no longer used
(replaced by original_filename + stored_filename). Make it nullable
so new inserts that don't provide it succeed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make the old filename column nullable (it's superseded by original_filename)
    op.alter_column(
        "documents",
        "filename",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade() -> None:
    # Backfill before making not-null again
    op.execute("UPDATE documents SET filename = original_filename WHERE filename IS NULL")
    op.alter_column(
        "documents",
        "filename",
        existing_type=sa.String(length=255),
        nullable=False,
    )
