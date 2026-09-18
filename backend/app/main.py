"""
DocMind AI — FastAPI application entry point.

Startup:
    uvicorn app.main:app --reload --port 8000

API docs:
    http://localhost:8000/docs  (Swagger UI)
    http://localhost:8000/redoc (ReDoc)
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from functools import partial
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.middleware.cors import add_cors_middleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.

    Startup (in order):
      1. Load embedding model into memory (CPU, ~1-2s first run)
      2. Connect to Qdrant and ensure collection exists
      3. Configure Gemini AI client
      4. App is ready to serve requests

    Shutdown:
      - Unload model from memory
    """
    # Import singletons here to avoid circular imports
    from app.services.embedding_service import embedding_service
    from app.services.vector_store_service import vector_store
    from app.services.gemini_service import gemini_service

    # ── Load embedding model (blocking, run in threadpool) ─────────────────
    logger.info("Starting DocMind AI — loading embedding model...")
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, embedding_service.load)
        logger.info("Embedding model ready. dim=%d", embedding_service.vector_dim)
    except Exception as exc:
        logger.error("Embedding model failed to load: %s", exc)
        # Continue startup — app still works without embeddings

    # ── Connect to Qdrant ──────────────────────────────────────────────────
    if embedding_service.is_loaded:
        try:
            connect_fn = partial(vector_store.connect, embedding_service.vector_dim)
            await loop.run_in_executor(None, connect_fn)
        except Exception as exc:
            logger.error("Qdrant connection failed: %s", exc)

    # ── Post-startup validation ────────────────────────────────────────────
    issues = vector_store.validate_startup()
    if issues:
        logger.warning("Startup issues detected: %s", issues)
    else:
        logger.info("All systems go — embedding model + Qdrant ready.")

    # ── Configure Gemini AI ────────────────────────────────────────────────
    gemini_service.configure()

    logger.info("DocMind AI startup complete. Gemini ready=%s", gemini_service.is_ready)
    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("DocMind AI shutting down...")
    embedding_service.unload()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "DocMind AI backend API — Authentication, Document Management, "
        "PDF Processing, Text Chunking, Embeddings, Vector Search, and RAG with Gemini 2.5 Flash."
    ),
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────
add_cors_middleware(app)

# ── Routes ─────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check() -> JSONResponse:
    """Liveness probe — reports embedding model, Qdrant, and Gemini status."""
    from app.services.embedding_service import embedding_service
    from app.services.gemini_service import gemini_service
    from app.services.vector_store_service import vector_store

    return JSONResponse({
        "status": "ok",
        "version": settings.APP_VERSION,
        "embedding_model": {
            "loaded": embedding_service.is_loaded,
            "name":   embedding_service.model_name,
            "dim":    embedding_service.vector_dim if embedding_service.is_loaded else None,
        },
        "vector_store": vector_store.health(),
        "gemini": {
            "ready": gemini_service.is_ready,
            "model": gemini_service.model_name,
        },
    })
