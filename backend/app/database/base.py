"""
SQLAlchemy declarative base.

All ORM models must import and inherit from `Base` defined here so that
Alembic can discover them automatically via `target_metadata`.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all DocMind AI ORM models."""
    pass
