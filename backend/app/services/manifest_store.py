"""Registry of uploaded/extracted manifests — same JSON-file pattern as
app/memory/memory_store.py, for the same reason: simple, human-inspectable,
no migrations, safe under FastAPI's threadpool via a lock + atomic write.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import get_settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()


def _registry_path() -> Path:
    path = get_settings().manifest_registry_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read_raw() -> dict[str, Any]:
    path = _registry_path()
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Manifest registry unreadable (%s) — treating as empty.", exc)
        return {}


def _write_raw(data: dict[str, Any]) -> None:
    path = _registry_path()
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    tmp.replace(path)


def register_manifest(*, filename: str, raw_text: str, page_count: int, pdf_path: str | None) -> str:
    """Store extracted text under a new manifest_id. Returns the id."""
    manifest_id = f"manifest_{uuid4().hex[:10]}"
    record = {
        "manifest_id": manifest_id,
        "filename": filename,
        "raw_text": raw_text,
        "character_count": len(raw_text),
        "page_count": page_count,
        "pdf_path": pdf_path,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        data = _read_raw()
        data[manifest_id] = record
        _write_raw(data)
    logger.info("Manifest registered: %s (%s, %d chars)", manifest_id, filename, len(raw_text))
    return manifest_id


def get_manifest(manifest_id: str) -> dict[str, Any] | None:
    with _lock:
        return _read_raw().get(manifest_id)


def list_manifests() -> list[dict[str, Any]]:
    with _lock:
        return list(_read_raw().values())