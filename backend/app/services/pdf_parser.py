"""PDF text extraction.

Uses pdfplumber for real text-layer PDFs (the sample manifests we generate,
and any manifest exported from a real system, have one). This is explicitly
NOT an OCR engine — a scanned image with no text layer will extract little
or nothing, and the caller must detect and report that rather than pretend
it worked. Swapping in real OCR later means replacing only this file.
"""

from __future__ import annotations

import logging

import pdfplumber

logger = logging.getLogger(__name__)


class PdfExtractionError(RuntimeError):
    """Raised when a PDF cannot be opened or read at all."""


def extract_text_from_pdf(file_bytes: bytes) -> tuple[str, int]:
    """Returns (extracted_text, page_count). Raises PdfExtractionError on a
    genuinely unreadable file — never returns silently-wrong data."""
    import io

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            page_count = len(pdf.pages)
            texts = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:
        raise PdfExtractionError(f"Could not read PDF: {exc}") from exc

    full_text = "\n".join(texts).strip()
    logger.info("Extracted %d chars across %d page(s)", len(full_text), page_count)
    return full_text, page_count