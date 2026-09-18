"""
Add sources_json to messages table for RAG citations.

Revision ID: 006
Adds: messages.sources_json (TEXT, nullable)
This column stores the RAG citation sources as a JSON string for assistant messages.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("sources_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "sources_json")
