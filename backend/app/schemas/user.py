"""
Pydantic schemas for user-facing data (never expose password_hash).
"""
import datetime

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    """Safe public representation of a User."""
    id: int
    name: str
    email: EmailStr
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Fields a user may update on their own profile."""
    name: str | None = None
    email: EmailStr | None = None
