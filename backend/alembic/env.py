"""
Alembic environment configuration for async SQLAlchemy.

Run migrations:
    alembic upgrade head
    alembic downgrade -1
    alembic revision --autogenerate -m "describe change"
"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

# Import all models so Alembic sees them in target_metadata
from app.database.base import Base
import app.models  # noqa: F401 — registers all ORM classes on Base.metadata

# Alembic Config object from alembic.ini
config = context.config

# Set the SQLAlchemy URL from our Settings (overrides alembic.ini value)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# Python logging setup from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations against a live async engine."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda conn: context.configure(
                connection=conn,
                target_metadata=target_metadata,
                compare_type=True,
            )
        )
        await connection.run_sync(lambda _: context.run_migrations())
    await engine.dispose()


def run_migrations_online() -> None:
    """Entry point for online migration mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
