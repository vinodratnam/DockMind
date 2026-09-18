"""
Async SQLAlchemy engine and session factory.

Usage in routes / services:
    async with AsyncSessionLocal() as session:
        ...

Or via the `get_db` FastAPI dependency in core/dependencies.py.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Engine — echo=True logs SQL in debug mode only
engine_args = {
    "echo": settings.DEBUG,
}

if not settings.DATABASE_URL.startswith("sqlite"):
    engine_args["pool_pre_ping"] = True
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_args
)

# Session factory — expire_on_commit=False prevents lazy-load errors after commit
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
