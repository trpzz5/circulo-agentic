"""POST /api/upload-manifest — accepts a PDF, extracts text, stores it.

Deliberately does NOT run the DNA agent here. Upload is the "extraction /
simulated OCR" step from the pipeline diagram; the DNA agent is a distinct
next step, called separately via POST /api/agents/dna with the manifest_id
this endpoint returns.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.api.schemas.waste import ManifestUploadResponse
from app.config import get_settings
from app.services.manifest_store import register_manifest
from app.services.pdf_parser import PdfExtractionError, extract_text_from_pdf

logger = logging.getLogger(__name__)
router = APIRouter(tags=["manifests"])

MIN_USABLE_CHARS = 40  # below this, almost certainly a scanned image with no text layer


@router.post(
    "/upload-manifest",
    response_model=ManifestUploadResponse,
    summary="Upload a waste manifest PDF for extraction",
)
async def upload_manifest(file: UploadFile = File(...)) -> ManifestUploadResponse:
    settings = get_settings()

    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=415, detail=f"Expected a PDF, got '{file.content_type}'.")

    body = await file.read()
    if len(body) > settings.manifest_max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(body)} bytes > {settings.manifest_max_bytes} limit).",
        )

    try:
        text, page_count = extract_text_from_pdf(body)
    except PdfExtractionError as exc:
        logger.warning("Manifest upload failed to parse: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Persist the original PDF too — useful for demo debugging and audit.
    settings.manifest_upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = (file.filename or "manifest.pdf").replace("/", "_")
    saved_path = settings.manifest_upload_dir / f"upload_{safe_name}"
    saved_path.write_bytes(body)

    manifest_id = register_manifest(
        filename=file.filename or "manifest.pdf",
        raw_text=text,
        page_count=page_count,
        pdf_path=str(saved_path),
    )

    return ManifestUploadResponse(
        manifest_id=manifest_id,
        filename=file.filename or "manifest.pdf",
        page_count=page_count,
        character_count=len(text),
        text_preview=text[:300],
        likely_unreadable=len(text) < MIN_USABLE_CHARS,
    )