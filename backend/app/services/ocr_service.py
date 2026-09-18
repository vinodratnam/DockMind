"""
OCR Fallback Service — Extracts text from scanned/image-based PDFs.

When PyMuPDF returns no text for a page (or too little text), this service
converts the page to an image and runs Tesseract OCR on it.

Requirements:
  - pytesseract (pip install pytesseract)
  - Pillow (pip install Pillow)
  - Tesseract binary must be installed on the system
    Windows: https://github.com/UB-Mannheim/tesseract/wiki
    Linux: sudo apt install tesseract-ocr
    macOS: brew install tesseract

Config:
  - MIN_TEXT_CHARS_PER_PAGE: pages with fewer chars trigger OCR fallback
  - OCR_DPI: rendering DPI for image quality (150=fast, 300=accurate)
"""
import logging
from io import BytesIO
from typing import Optional

logger = logging.getLogger(__name__)

# If a page has fewer than this many characters, assume it's image-based
MIN_TEXT_CHARS_PER_PAGE = 50

# DPI for rendering PDF page to image (higher = better OCR, slower)
OCR_DPI = 200


def is_ocr_needed(page_text: str) -> bool:
    """Return True if the page text is too short to be useful (likely image-based)."""
    return len(page_text.strip()) < MIN_TEXT_CHARS_PER_PAGE


def ocr_page_from_pdf(pdf_path: str, page_num: int) -> str:
    """
    Run OCR on a single PDF page and return extracted text.

    Args:
        pdf_path: Absolute path to the PDF file.
        page_num: 0-indexed page number.

    Returns:
        Extracted text string (may be empty if OCR finds nothing).
    """
    try:
        import fitz
        import pytesseract
        from PIL import Image

        doc = fitz.open(pdf_path)
        page = doc.load_page(page_num)

        # Render page as high-res image
        mat = fitz.Matrix(OCR_DPI / 72, OCR_DPI / 72)  # scale factor
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_data = pix.tobytes("png")
        doc.close()

        # Run Tesseract
        image = Image.open(BytesIO(img_data))
        text = pytesseract.image_to_string(image, lang="eng")

        logger.info(
            "[OCR] Page %d extracted %d chars via Tesseract",
            page_num + 1, len(text.strip()),
        )
        return text

    except ImportError as exc:
        logger.warning("[OCR] Dependency missing — %s. Install pytesseract + Pillow.", exc)
        return ""
    except Exception as exc:
        logger.error("[OCR] Failed on page %d: %s", page_num + 1, exc)
        return ""


def extract_pages_with_ocr_fallback(pdf_path: str) -> list[tuple[int, str, bool]]:
    """
    Extract text from all PDF pages, falling back to OCR for image-based pages.

    Returns:
        List of (page_number, text, used_ocr) tuples (1-indexed page numbers).
        'used_ocr' is True if OCR was used for that page.
    """
    try:
        import fitz
    except ImportError:
        logger.error("[OCR] PyMuPDF not installed.")
        return []

    from pathlib import Path
    path = Path(pdf_path)
    if not path.exists():
        logger.error("[OCR] File not found: %s", pdf_path)
        return []

    try:
        doc = fitz.open(str(path))
    except Exception as exc:
        logger.error("[OCR] Cannot open PDF: %s", exc)
        return []

    pages: list[tuple[int, str, bool]] = []
    ocr_page_count = 0

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")

        used_ocr = False
        if is_ocr_needed(text):
            logger.info(
                "[OCR] Page %d has only %d chars — triggering OCR fallback",
                page_num + 1, len(text.strip()),
            )
            doc.close()  # close before OCR (re-opens internally)
            ocr_text = ocr_page_from_pdf(pdf_path, page_num)
            doc = fitz.open(str(path))  # re-open for remaining pages
            if ocr_text.strip():
                text = ocr_text
                used_ocr = True
                ocr_page_count += 1

        pages.append((page_num + 1, text, used_ocr))

    doc.close()

    logger.info(
        "[OCR] Extraction complete — %d pages, %d used OCR",
        len(pages), ocr_page_count,
    )
    return pages
