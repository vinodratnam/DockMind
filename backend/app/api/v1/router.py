"""
Aggregate all v1 API routers into a single APIRouter.
Import this router in main.py with an /api/v1 prefix.
"""
from fastapi import APIRouter

from app.api.v1 import auth, chats, documents

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(documents.router)
api_router.include_router(documents.vector_router)
api_router.include_router(chats.router)
