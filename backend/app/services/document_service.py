"""
Document service — handles file storage on disk AND metadata in PostgreSQL.

Storage layout:
    backend/storage/uploads/<uuid4>.<ext>

Rules:
  - PDF and image files accepted (PNG, JPG, JPEG, WEBP)
  - Maximum 20 MB per file
  - UUID-based filenames prevent collisions and hide user info
  - Database stores metadata only; actual bytes live on disk
  - Images are processed via OCR fallback when text extraction is triggered
"""
import os
import uuid
import aiofiles
import aiofiles.os

from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.document import Document
from app.core.config import settings

# ── Constants ──────────────────────────────────────────────────────────────
ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
IMAGE_EXTENSIONS   = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_MIMES        = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB

# Storage root — resolved relative to this file's location so it works
# regardless of where uvicorn is launched from.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # …/backend/
STORAGE_DIR = _BACKEND_ROOT / "storage" / "uploads"


def _ensure_storage() -> None:
    """Create the uploads directory if it doesn't exist yet."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


# ── Helpers ────────────────────────────────────────────────────────────────

def _validate_file(file: UploadFile) -> None:
    """Raise HTTP 422 for invalid file type or size."""
    ext = Path(file.filename or "").suffix.lower()
    mime = (file.content_type or "").split(";")[0].strip().lower()

    if mime not in ALLOWED_MIME and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Only PDF and image files (PNG, JPG, WEBP) are accepted. "
                f"Received MIME type '{mime}' with extension '{ext}'."
            ),
        )


# ── Service functions ──────────────────────────────────────────────────────

async def upload_document(
    db: AsyncSession,
    user_id: int,
    file: UploadFile,
) -> Document:
    """
    Validate, save, and record an uploaded PDF.

    Steps:
      1. Validate file type (PDF only)
      2. Read bytes and enforce 20 MB limit
      3. Generate UUID filename and write to disk
      4. Persist metadata in PostgreSQL
      5. Return the created Document row
    """
    _ensure_storage()
    _validate_file(file)

    # Read entire file into memory to check size
    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the 20 MB limit. Received {len(content) / 1024 / 1024:.1f} MB.",
        )

    # Generate a unique stored filename
    ext = Path(file.filename or "upload").suffix.lower() or ".pdf"
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = STORAGE_DIR / stored_filename

    # Write to disk asynchronously
    async with aiofiles.open(file_path, "wb") as fp:
        await fp.write(content)

    # Persist metadata
    doc = Document(
        user_id=user_id,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=file.content_type or "application/pdf",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def get_document(
    db: AsyncSession,
    document_id: int,
    user_id: int,
) -> Document | None:
    """Return a document only if it belongs to the requesting user."""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def list_user_documents(
    db: AsyncSession,
    user_id: int,
) -> list[Document]:
    """Return all documents owned by a user, newest first."""
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_document(
    db: AsyncSession,
    document_id: int,
    user_id: int,
) -> bool:
    """
    Delete a document record AND remove the file from disk.

    Returns True if the document existed and was deleted, False otherwise.
    Ownership is enforced: a user can only delete their own documents.
    """
    doc = await get_document(db, document_id, user_id)
    if doc is None:
        return False

    # Remove file from disk first (best-effort — proceed even if file is missing)
    file_path = Path(doc.file_path)
    if file_path.exists():
        try:
            await aiofiles.os.remove(file_path)
        except OSError:
            pass  # Log in production; don't fail the request

    await db.delete(doc)
    await db.commit()
    return True
