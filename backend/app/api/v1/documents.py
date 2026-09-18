"""
Document routes — /api/v1/documents/*

Endpoints:
  POST   /documents/upload             — Upload a PDF
  GET    /documents/                   — List user's documents
  GET    /documents/{id}               — Get document metadata
  DELETE /documents/{id}               — Delete document, file, chunks, and Qdrant vectors
  POST   /documents/{id}/process       — Extract text + chunk
  GET    /documents/{id}/chunks        — List text chunks with embedding status
  POST   /documents/{id}/embed         — Generate embeddings + store in Qdrant
  GET    /documents/{id}/embed-status  — Detailed embedding progress
  GET    /vector-store/health          — Rich Qdrant health check
  GET    /vector-store/validate        — Post-startup system validation
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.document import (
    ChunkRead,
    DocumentDeleteResponse,
    DocumentRead,
    EmbedResponse,
    EmbeddingStatusResponse,
    ProcessResponse,
    StartupValidation,
    VectorStoreHealth,
)
from app.services.document_service import (
    delete_document,
    get_document,
    list_user_documents,
    upload_document,
)
from app.services.document_processing_service import (
    get_document_chunks,
    process_document,
)
from app.services.document_embedding_service import (
    embed_document,
    get_embedding_status,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


# ── Upload ─────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a PDF document",
    description="Accepts a PDF (max 20 MB). Stores file with UUID name. Status starts as 'uploaded'.",
)
async def upload(
    file: UploadFile = File(..., description="PDF file to upload"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentRead:
    return await upload_document(db, current_user.id, file)


# ── List ───────────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[DocumentRead],
    summary="List user's documents",
    description="Returns all documents for the authenticated user, newest first.",
)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentRead]:
    return await list_user_documents(db, current_user.id)


# ── Get single ─────────────────────────────────────────────────────────────

@router.get(
    "/{document_id}",
    response_model=DocumentRead,
    summary="Get document metadata",
)
async def get(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentRead:
    doc = await get_document(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return doc


# ── Process ────────────────────────────────────────────────────────────────

@router.post(
    "/{document_id}/process",
    response_model=ProcessResponse,
    summary="Extract text and chunk a PDF",
    description=(
        "Runs the full text extraction pipeline: read PDF → clean text → chunk. "
        "Chunks stored in PostgreSQL. Status → 'processed'. Idempotent."
    ),
)
async def process(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProcessResponse:
    doc = await get_document(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    result = await process_document(db, doc)
    return ProcessResponse(
        document_id=document_id,
        status="processed",
        page_count=result["page_count"],
        chunk_count=result["chunk_count"],
        processing_time_seconds=result["processing_time_seconds"],
    )


# ── Get Chunks ─────────────────────────────────────────────────────────────

@router.get(
    "/{document_id}/chunks",
    response_model=list[ChunkRead],
    summary="List text chunks with embedding status",
    description="Returns all chunks ordered by chunk_index. Each chunk shows embedding_status.",
)
async def list_chunks(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChunkRead]:
    doc = await get_document(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    if doc.processing_status != "processed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Document status is '{doc.processing_status}'. Run /process first.",
        )
    return await get_document_chunks(db, document_id)


# ── Embed ──────────────────────────────────────────────────────────────────

@router.post(
    "/{document_id}/embed",
    response_model=EmbedResponse,
    summary="Generate embeddings and store in Qdrant",
    description=(
        "Converts all text chunks into 384-dimensional vectors using "
        "BAAI/bge-small-en-v1.5 (cosine similarity). Upserts into Qdrant "
        "with rich metadata payload (full content, filename, model, timestamps). "
        "Duplicate prevention: skips if all chunks already embedded "
        "(use ?force=true to re-index). Idempotent."
    ),
)
async def embed(
    document_id: int,
    force: bool = Query(
        default=False,
        description="If true, re-embed even if already embedded (re-index).",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmbedResponse:
    doc = await get_document(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    result = await embed_document(db, doc, force=force)

    return EmbedResponse(
        document_id=document_id,
        chunk_count=result["chunk_count"],
        vector_dim=result["vector_dim"],
        model_name=result["model_name"],
        processing_time_seconds=result["processing_time_seconds"],
        status="skipped" if result.get("skipped") else "embedded",
        skipped=result.get("skipped", False),
        skip_reason=result.get("skip_reason"),
    )


# ── Embedding status ───────────────────────────────────────────────────────

@router.get(
    "/{document_id}/embed-status",
    response_model=EmbeddingStatusResponse,
    summary="Detailed embedding progress",
    description="Returns per-status chunk counts and last embedded timestamp.",
)
async def embed_status(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmbeddingStatusResponse:
    doc = await get_document(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    stats = await get_embedding_status(db, document_id)
    return EmbeddingStatusResponse(
        document_id=document_id,
        **stats,
    )


# ── Delete ─────────────────────────────────────────────────────────────────

@router.delete(
    "/{document_id}",
    response_model=DocumentDeleteResponse,
    summary="Delete document, chunks, and Qdrant vectors",
    description="Permanently removes the document record, file on disk, all chunks, and Qdrant vectors.",
)
async def remove(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentDeleteResponse:
    # Delete Qdrant vectors first (best-effort — proceed even if Qdrant is down)
    from app.services.vector_store_service import vector_store
    delete_result = vector_store.delete_by_document(document_id)
    if delete_result.get("success"):
        pass  # Logged internally

    deleted = await delete_document(db, document_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return DocumentDeleteResponse(
        message="Document deleted successfully.",
        document_id=document_id,
    )


# ══════════════════════════════════════════════════════════════════════════════
# VECTOR STORE ROUTES
# ══════════════════════════════════════════════════════════════════════════════

vector_router = APIRouter(prefix="/vector-store", tags=["Vector Store"])


@vector_router.get(
    "/health",
    response_model=VectorStoreHealth,
    summary="Qdrant collection health",
    description=(
        "Returns connection status, vector count, collection dimensions, "
        "embedding model, and Qdrant mode. Useful for monitoring dashboards."
    ),
)
async def vector_health(
    current_user: User = Depends(get_current_user),
) -> VectorStoreHealth:
    from app.services.vector_store_service import vector_store
    health = vector_store.health()
    return VectorStoreHealth(**health)


@vector_router.get(
    "/validate",
    response_model=StartupValidation,
    summary="Post-startup system validation",
    description=(
        "Validates that the embedding model is loaded, Qdrant is connected, "
        "and the vector dimension matches. Returns a list of any issues found."
    ),
)
async def vector_validate(
    current_user: User = Depends(get_current_user),
) -> StartupValidation:
    from app.services.vector_store_service import vector_store
    from app.services.embedding_service import embedding_service

    issues = vector_store.validate_startup()
    return StartupValidation(
        all_ok=len(issues) == 0,
        issues=issues,
        embedding_loaded=embedding_service.is_loaded,
        qdrant_connected=vector_store.is_connected,
        vector_dim=embedding_service.vector_dim if embedding_service.is_loaded else None,
    )
