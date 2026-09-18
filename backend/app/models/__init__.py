# Export all ORM models so Alembic target_metadata picks them up
from app.models.user import User                  # noqa: F401
from app.models.document import Document          # noqa: F401
from app.models.chunk import DocumentChunk        # noqa: F401
from app.models.chat import Chat                  # noqa: F401
from app.models.message import Message            # noqa: F401
