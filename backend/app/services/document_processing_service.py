"""
Document Processing Service — PDF Reading, Text Extraction, Chunking.

Pipeline:
  1. Read PDF bytes from disk using stored file_path
  2. Extract text page-by-page with PyMuPDF (fitz)
  3. Clean each page's text (normalise whitespace, fix broken lines)
  4. Chunk text into ~800-character segments with 150-character overlap
  5. Persist DocumentChunk rows in PostgreSQL
  6. Update Document.processing_status / page_count / chunk_count / processed_at

Chunking strategy:
  - Prefer paragraph boundaries (double newline)
  - Never split mid-word
  - Overlap between consecutive chunks for context continuity
"""
import re
import time
import datetime
from pathlib import Path

import fitz  # PyMuPDF

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, status

from app.models.document import Document
from app.models.chunk import DocumentChunk

# ── Configuration ──────────────────────────────────────────────────────────
CHUNK_SIZE    = 800   # target characters per chunk
CHUNK_OVERLAP = 150   # characters of overlap between consecutive chunks


# ── Text Cleaning ──────────────────────────────────────────────────────────

def clean_text(raw: str) -> str:
    """
    Normalise extracted PDF text into clean, readable paragraphs.

    Rules applied (in order):
      1. Replace form-feed / carriage-return with newline
      2. Remove soft hyphenation (word- \\n word → wordword)
      3. Join lines that are NOT paragraph boundaries
         (single newline inside a paragraph → space)
      4. Collapse 3+ blank lines → 2 blank lines
      5. Strip leading/trailing whitespace per paragraph
      6. Collapse multiple spaces to one

    Intentionally preserved:
      - Sentence-level capitalisation
      - Punctuation
      - Paragraph separation (double newline)
    """
    if not raw:
        return ""

    text = raw

    # 1. Normalise line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\f", "\n")

    # 2. Remove soft hyphens at line breaks (e.g. "connec-\ntion" → "connection")
    text = re.sub(r"-\n(?=[a-z])", "", text)

    # 3. Collapse single newlines inside paragraphs into spaces.
    #    Paragraph boundary = two or more newlines (kept as-is).
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)

    # 4. Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 5. Strip each paragraph
    paragraphs = [p.strip() for p in text.split("\n\n")]
    paragraphs = [p for p in paragraphs if p]   # remove empty paragraphs

    # 6. Collapse internal multiple spaces
    paragraphs = [re.sub(r" {2,}", " ", p) for p in paragraphs]

    return "\n\n".join(paragraphs)


# ── Chunking ───────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    page_number: int,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[dict]:
    """
    Split cleaned text into overlapping chunks.

    Strategy:
      - Split on paragraph boundaries (\\n\\n) first
      - If a paragraph fits in remaining chunk space, append it
      - If a paragraph is too large, split at sentence boundaries (. ! ?)
        then at word boundaries
      - Overlap: the last `overlap` characters of the previous chunk
        become the first characters of the next

    Returns a list of dicts: {page_number, chunk_index, content, character_count, estimated_token_count}
    """
    if not text.strip():
        return []

    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if not current:
            current = para
            continue

        # Will this paragraph fit in the current chunk?
        candidate = current + "\n\n" + para
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            # Save current chunk
            chunks.append(current)
            # Does the paragraph itself exceed chunk_size?
            if len(para) > chunk_size:
                # Split the large paragraph into sub-chunks
                sub_chunks = _split_large_text(para, chunk_size, overlap)
                # First sub-chunk gets overlap from previous chunk
                if chunks and overlap > 0:
                    tail = chunks[-1][-overlap:]
                    sub_chunks[0] = tail + " " + sub_chunks[0]
                chunks.extend(sub_chunks[:-1])
                current = sub_chunks[-1]
            else:
                # Start a new chunk with overlap from previous
                if overlap > 0 and current:
                    tail = current[-overlap:]
                    current = tail + " " + para
                else:
                    current = para

    if current.strip():
        chunks.append(current.strip())

    # Build result dicts
    result = []
    for idx, content in enumerate(chunks):
        content = content.strip()
        if not content:
            continue
        char_count = len(content)
        result.append({
            "page_number":            page_number,
            "chunk_index":            idx,
            "content":                content,
            "character_count":        char_count,
            "estimated_token_count":  max(1, char_count // 4),
        })
    return result


def _split_large_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Split a single large block of text into chunks of at most `chunk_size`
    characters, never splitting mid-word.
    """
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:].strip())
            break
        # Walk back to the nearest word boundary
        while end > start and text[end] not in (" ", "\n", ".", "!", "?"):
            end -= 1
        if end == start:
            end = start + chunk_size  # no boundary found — hard cut
        chunks.append(text[start:end].strip())
        # Next chunk starts with overlap
        start = max(start + 1, end - overlap)
    return [c for c in chunks if c]


# ── PDF Extraction (with OCR Fallback) ────────────────────────────────────

def extract_pages(file_path: str) -> list[tuple[int, str]]:
    """
    Open a PDF and extract text page-by-page.

    For pages with insufficient text (scanned/image-based PDFs), automatically
    falls back to Tesseract OCR to extract text from the rendered page image.

    Returns: list of (page_number, raw_text) tuples (1-indexed page numbers).

    Raises HTTPException for:
      - File not found
      - Password-protected PDF
      - Corrupted / unreadable PDF
      - Empty PDF (no text on any page AND OCR failed)
    """
    import logging as _logging
    _logger = _logging.getLogger(__name__)

    path = Path(file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PDF file not found on disk: {file_path}",
        )

    try:
        doc = fitz.open(str(path))
    except fitz.FileDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Corrupted or unreadable PDF: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to open PDF: {exc}",
        )

    if doc.is_encrypted:
        doc.close()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password-protected PDFs are not supported.",
        )

    # Extract text with per-page OCR fallback
    raw_pages: list[tuple[int, str]] = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")  # plain text, reading order
        raw_pages.append((page_num + 1, text))

    doc.close()

    if not raw_pages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF has no pages.",
        )

    # Check if total text is too sparse → try OCR fallback
    total_text = "".join(t for _, t in raw_pages).strip()
    if not total_text:
        _logger.warning(
            "[Processing] PDF '%s' has no extractable text — attempting OCR fallback.",
            file_path,
        )
        try:
            from app.services.ocr_service import extract_pages_with_ocr_fallback
            ocr_result = extract_pages_with_ocr_fallback(file_path)
            if ocr_result:
                pages_with_text = [(pn, txt) for pn, txt, _ in ocr_result if txt.strip()]
                if pages_with_text:
                    _logger.info(
                        "[Processing] OCR recovered text from %d/%d pages.",
                        len(pages_with_text), len(ocr_result),
                    )
                    return [(pn, txt) for pn, txt, _ in ocr_result]
        except Exception as exc:
            _logger.error("[Processing] OCR fallback failed: %s", exc)

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "PDF contains no extractable text. "
                "If this is a scanned document, please install Tesseract OCR "
                "(https://github.com/UB-Mannheim/tesseract/wiki) and re-process."
            ),
        )

    # Per-page OCR for pages with too little text (even if other pages have text)
    from app.services.ocr_service import is_ocr_needed, ocr_page_from_pdf
    final_pages: list[tuple[int, str]] = []
    for page_num_1indexed, text in raw_pages:
        if is_ocr_needed(text):
            _logger.info(
                "[Processing] Page %d sparse (%d chars) — trying OCR.",
                page_num_1indexed, len(text.strip()),
            )
            ocr_text = ocr_page_from_pdf(file_path, page_num_1indexed - 1)
            if ocr_text.strip():
                final_pages.append((page_num_1indexed, ocr_text))
                continue
        final_pages.append((page_num_1indexed, text))

    return final_pages


# ── Main pipeline function ─────────────────────────────────────────────────

async def process_document(
    db: AsyncSession,
    document: Document,
) -> dict:
    """
    Full processing pipeline for a document.

    Steps:
      1. Mark document as processing
      2. Extract text from PDF
      3. Clean each page's text
      4. Chunk each page
      5. Delete any previous chunks (idempotent re-processing)
      6. Bulk-insert new chunks
      7. Update document status to processed

    Returns a summary dict: {page_count, chunk_count, processing_time_seconds}
    """
    start_time = time.monotonic()

    # ── Step 1: Mark as processing ─────────────────────────────────────────
    document.processing_status = "processing"
    document.processing_error  = None
    await db.commit()

    try:
        # ── Step 2: Extract text (PDF or image via OCR) ───────────────────
        ext = (document.file_path or '').lower().rsplit('.', 1)[-1]
        image_exts = {'png', 'jpg', 'jpeg', 'webp'}
        image_mimes = {'image/png', 'image/jpeg', 'image/jpg', 'image/webp'}
        mime = (document.mime_type or '').lower()

        if ext in image_exts or mime in image_mimes:
            # Image file — run OCR directly
            import logging as _logging
            _logger = _logging.getLogger(__name__)
            _logger.info("[Processing] Image file detected (%s) — running OCR", ext)
            try:
                from app.services.ocr_service import ocr_page_from_pdf
                # For standalone images, use pytesseract directly
                import pytesseract
                from PIL import Image as PILImage
                ocr_text = pytesseract.image_to_string(PILImage.open(document.file_path), lang='eng')
                pages = [(1, ocr_text)] if ocr_text.strip() else []
                if not pages:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail='OCR could not extract any text from this image. Ensure the image is clear and contains text.',
                    )
            except ImportError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail='Image processing requires Tesseract OCR. Please install it from https://github.com/UB-Mannheim/tesseract/wiki',
                )
        else:
            pages = extract_pages(document.file_path)

        # ── Step 3 & 4: Clean + chunk each page ───────────────────────────
        all_chunk_dicts: list[dict] = []
        for page_num, raw_text in pages:
            cleaned = clean_text(raw_text)
            if not cleaned:
                continue
            page_chunks = chunk_text(cleaned, page_number=page_num)
            all_chunk_dicts.extend(page_chunks)

        # Re-number chunk_index globally across all pages
        for global_idx, c in enumerate(all_chunk_dicts):
            c["chunk_index"] = global_idx

        # ── Step 5: Delete previous chunks (idempotent) ───────────────────
        await db.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )

        # ── Step 6: Bulk insert chunks ────────────────────────────────────
        chunk_objects = [
            DocumentChunk(
                document_id=document.id,
                page_number=c["page_number"],
                chunk_index=c["chunk_index"],
                content=c["content"],
                character_count=c["character_count"],
                estimated_token_count=c["estimated_token_count"],
            )
            for c in all_chunk_dicts
        ]
        db.add_all(chunk_objects)

        # ── Step 7: Update document metadata ──────────────────────────────
        elapsed = time.monotonic() - start_time
        document.processing_status = "processed"
        document.page_count  = len(pages)
        document.chunk_count = len(chunk_objects)
        document.processed_at = datetime.datetime.now(datetime.timezone.utc)
        document.processing_error = None

        await db.commit()

        return {
            "page_count":               len(pages),
            "chunk_count":              len(chunk_objects),
            "processing_time_seconds":  round(elapsed, 3),
        }

    except HTTPException:
        # Re-raise known errors after marking document as failed
        document.processing_status = "failed"
        document.processing_error  = "Document could not be read or processed."
        await db.commit()
        raise

    except Exception as exc:
        document.processing_status = "failed"
        document.processing_error  = str(exc)[:1000]
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during processing: {exc}",
        )


# ── Chunk query helper ─────────────────────────────────────────────────────

async def get_document_chunks(
    db: AsyncSession,
    document_id: int,
) -> list[DocumentChunk]:
    """Return all chunks for a document, ordered by chunk_index."""
    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    return list(result.scalars().all())
