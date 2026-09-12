"""SQLite connection layer.

Deliberately NOT an ORM. CIRCULO's data is ~15 read-mostly rows; raw sqlite3
with a Row factory is faster to start, easier to reason about, and has no
session/identity-map failure modes.
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import get_settings

logger = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
SCHEMA_VERSION = "2"  # bumped from Phase 1's "0" now that the domain schema exists

_PRAGMAS: tuple[str, ...] = (
    "PRAGMA journal_mode = WAL",
    "PRAGMA foreign_keys = ON",
    "PRAGMA busy_timeout = 5000",
    "PRAGMA synchronous = NORMAL",
)


class DatabaseError(RuntimeError):
    """Raised for CIRCULO-level database failures. Never swallowed silently."""


def _create_connection() -> sqlite3.Connection:
    settings = get_settings()
    db_path = settings.resolved_database_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        conn = sqlite3.connect(db_path, check_same_thread=False, timeout=5.0)
    except sqlite3.Error as exc:
        raise DatabaseError(f"Cannot open SQLite database at {db_path}: {exc}") from exc

    conn.row_factory = sqlite3.Row
    for pragma in _PRAGMAS:
        conn.execute(pragma)
    return conn


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
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
    """FastAPI dependency."""
    with get_connection() as conn:
        yield conn


def apply_schema() -> None:
    """Execute schema.sql. Safe to call on every startup — every statement is
    IF NOT EXISTS, so this never touches existing data."""
    if not SCHEMA_PATH.exists():
        raise DatabaseError(f"schema.sql not found at {SCHEMA_PATH}")

    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection() as conn:
        conn.executescript(sql)
    logger.info("Domain schema applied from %s", SCHEMA_PATH)


def init_db() -> None:
    """Ensure the database exists, the domain schema is applied, and the
    metadata marker reflects the current schema version."""
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

    apply_schema()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO circulo_meta (key, value, updated_at)
            VALUES ('schema_version', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            """,
            (SCHEMA_VERSION,),
        )
    logger.info("SQLite ready at %s (schema_version=%s)", get_settings().resolved_database_path, SCHEMA_VERSION)


def check_database() -> tuple[bool, str]:
    """Health probe. Returns (ok, detail) and never raises."""
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT value FROM circulo_meta WHERE key = 'schema_version'"
            ).fetchone()
            factory_count = conn.execute("SELECT COUNT(*) AS c FROM factories").fetchone()["c"]
        version = row["value"] if row else "unknown"
        return True, f"sqlite ok (schema_version={version}, factories={factory_count})"
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        return False, f"{type(exc).__name__}: {exc}"