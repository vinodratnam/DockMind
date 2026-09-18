"""
CORS middleware configuration.

Imported and applied in main.py. Adjust allowed origins for production.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


def add_cors_middleware(app: FastAPI) -> None:
    """Register CORSMiddleware on the FastAPI application instance."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.FRONTEND_URL,
            # Add staging / production URLs here as needed
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
