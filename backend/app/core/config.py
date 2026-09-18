"""
Application configuration using pydantic-settings.
All settings are loaded from environment variables (or .env file).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # ── Application ────────────────────────────────────────────────────────
    APP_NAME: str = "DocMind AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ── Database ───────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/docmind"

    # ── Security / JWT ─────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-minimum-32-characters-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ───────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    # ── File Storage ───────────────────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 20

    # ── Qdrant Vector Database ─────────────────────────────────────────────
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "document_chunks"
    # Set to "memory" for in-process storage (no Docker needed) or "http" for server
    QDRANT_MODE: str = "memory"

    # ── Embedding Model ────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_BATCH_SIZE: int = 32

    # ── Gemini AI ──────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # ── RAG Settings ───────────────────────────────────────────────────────
    RAG_TOP_K: int = 5
    RAG_SCORE_THRESHOLD: float = 0.25
    RAG_MAX_CONTEXT_CHARS: int = 12000   # Max chars sent to Gemini

    # ── Advanced Search Features ───────────────────────────────────────────
    HYBRID_SEARCH: bool = True           # Enable BM25 + Semantic + RRF fusion
    OCR_ENABLED: bool = True             # Enable Tesseract OCR fallback for scanned PDFs


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()


settings = get_settings()
