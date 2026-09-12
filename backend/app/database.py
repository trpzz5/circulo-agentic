"""SQLite connection layer.

Deliberately NOT an ORM. CIRCULO's data is ~15 read-mostly rows; raw sqlite3
with a Row factory is faster to start, easier to reason about, and has no
session/identity-map failure modes. The *schema* lives in app/database/ (Phase 2);
this module only manages connections.
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from app.config import get_settings

logger = logging.getLogger(__name__)

# Applied to every new connection.
_PRAGMAS: tuple[str, ...] = (
    "PRAGMA journal_mode = WAL",      # seed script + API can read/write together
    "PRAGMA foreign_keys = ON",       # OFF by default in SQLite — we want it ON
    "PRAGMA busy_timeout = 5000",     # wait 5s instead of raising 'database is locked'
    "PRAGMA synchronous = NORMAL",    # safe with WAL, noticeably faster
)


class DatabaseError(RuntimeError):
    """Raised for CIRCULO-level database failures. Never swallowed silently."""


def _create_connection() -> sqlite3.Connection:
    settings = get_settings()
    db_path = settings.resolved_database_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        conn = sqlite3.connect(
            db_path,
            # Allows the connection to be used from FastAPI's threadpool.
            # Safe here because each request gets its own short-lived connection.
            check_same_thread=False,
            timeout=5.0,
        )
    except sqlite3.Error as exc:
        raise DatabaseError(f"Cannot open SQLite database at {db_path}: {exc}") from exc

    # Rows behave like dicts -> dict(row) feeds straight into Pydantic models.
    conn.row_factory = sqlite3.Row
    for pragma in _PRAGMAS:
        conn.execute(pragma)
    return conn


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Context manager for scripts, seeding and tests.

    Commits on success, rolls back on any exception, and always closes.
    Exceptions are re-raised — we never hide a failure.
    """
    conn = _create_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("Database transaction rolled back")
        raise
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency. Usage:

        @router.get("/factories")
        def list_factories(db: sqlite3.Connection = Depends(get_db)):
            ...
    """
    with get_connection() as conn:
        yield conn


def init_db() -> None:
    """Ensure the database file exists and carries a metadata marker.

    Phase 1 intentionally creates NO domain tables — the full schema arrives in
    Phase 2. This only guarantees the file is present and writable so that
    /api/health can report a truthful status on a clean checkout.
    """
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS circulo_meta (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            INSERT INTO circulo_meta (key, value) VALUES ('schema_version', '0')
            ON CONFLICT(key) DO NOTHING
            """
        )
    logger.info("SQLite ready at %s", get_settings().resolved_database_path)


def check_database() -> tuple[bool, str]:
    """Health probe. Returns (ok, detail) and never raises."""
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT value FROM circulo_meta WHERE key = 'schema_version'"
            ).fetchone()
        version = row["value"] if row else "unknown"
        return True, f"sqlite ok (schema_version={version})"
    except Exception as exc:  # health checks must degrade, not crash
        logger.warning("Database health check failed: %s", exc)
        return False, f"{type(exc).__name__}: {exc}"