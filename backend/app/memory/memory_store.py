"""Persistent agent memory — a flat, human-inspectable JSON file.

Chosen over a table per your own spec ("JSON or SQLite acceptable — keep it
simple"): this is the one piece of state you may want to hand-edit between
demo runs (e.g. to add a rejection reason live), and a JSON file makes that
trivial. Concurrency-safe within one process via a lock + atomic replace.
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


def _memory_path() -> Path:
    path = get_settings().memory_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ══════════════════════════════════════════════════════════════════════════
#  Golden Path default memory — makes the rejection deterministic from boot
# ══════════════════════════════════════════════════════════════════════════

_DEFAULT_RECORDS: list[dict[str, Any]] = [
    {
        "id": "mem_golden_rejection_001",
        "factory_id": "cement_plant_x",
        "factory_name": "Sagar Cement Works",
        "material_id": "foundry_sand",
        "material_name": "Foundry Sand",
        "source_factory": "ABC Foundry",
        "outcome": "rejected",
        "reason": "moisture_above_limit",
        "limit_percent": 10.0,
        "observed_percent": 12.0,
        "date": "2026-03-14T09:00:00+00:00",
        "notes": "Prior shipment refused at intake — moisture exceeded contractual limit.",
    },
    {
        "id": "mem_golden_success_001",
        "factory_id": "glass_mfr_z",
        "factory_name": "Karavali Glass Industries",
        "material_id": "processed_foundry_sand",
        "material_name": "Processed Foundry Sand",
        "source_factory": "Dakshina Processing Solutions",
        "outcome": "accepted",
        "reason": "within_spec",
        "limit_percent": 8.0,
        "observed_percent": 5.0,
        "date": "2026-04-02T09:00:00+00:00",
        "notes": "Prior processed-sand shipment accepted without issue.",
    },
]


def _read_raw() -> list[dict[str, Any]]:
    path = _memory_path()
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Memory file unreadable (%s) — treating as empty.", exc)
        return []


def _write_raw(records: list[dict[str, Any]]) -> None:
    """Atomic write: write to a temp file, then replace. Never leaves a
    half-written memory file even if the process is killed mid-write."""
    path = _memory_path()
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    tmp.replace(path)


def seed_if_empty() -> None:
    """Called once at startup. Never overwrites real data."""
    with _lock:
        if not _read_raw():
            _write_raw(_DEFAULT_RECORDS)
            logger.info("Memory store seeded with %d default record(s).", len(_DEFAULT_RECORDS))


def list_records() -> list[dict[str, Any]]:
    with _lock:
        return _read_raw()


def record_outcome(
    *,
    factory_id: str,
    factory_name: str,
    material_id: str,
    material_name: str,
    source_factory: str,
    outcome: str,
    reason: str,
    limit_percent: float | None = None,
    observed_percent: float | None = None,
    notes: str = "",
) -> dict[str, Any]:
    """Append a new memory record. Used by the Decision Agent in Phase 6."""
    record = {
        "id": f"mem_{uuid4().hex[:10]}",
        "factory_id": factory_id,
        "factory_name": factory_name,
        "material_id": material_id,
        "material_name": material_name,
        "source_factory": source_factory,
        "outcome": outcome,
        "reason": reason,
        "limit_percent": limit_percent,
        "observed_percent": observed_percent,
        "date": _utc_now_iso(),
        "notes": notes,
    }
    with _lock:
        records = _read_raw()
        records.append(record)
        _write_raw(records)
    logger.info("Memory recorded: %s x %s -> %s (%s)", factory_id, material_id, outcome, reason)
    return record


def find_prior_outcomes(factory_id: str, material_id: str) -> list[dict[str, Any]]:
    """What the Decision Agent queries before recommending a route."""
    with _lock:
        records = _read_raw()
    return [r for r in records if r["factory_id"] == factory_id and r["material_id"] == material_id]