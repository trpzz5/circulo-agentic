"""Shared material-name resolution — maps a free-text material name (as it
appears in Waste DNA) to the catalog's canonical material_id. Used by any
agent that needs to look up materials-table data.
"""

from __future__ import annotations

import sqlite3


def resolve_material_id(conn: sqlite3.Connection, material_name: str) -> tuple[str | None, str]:
    row = conn.execute(
        "SELECT material_id, name FROM materials WHERE lower(name) = lower(?)", (material_name,)
    ).fetchone()
    if row:
        return row["material_id"], row["name"]

    slug = material_name.strip().lower().replace(" ", "_")
    row = conn.execute("SELECT material_id, name FROM materials WHERE material_id = ?", (slug,)).fetchone()
    if row:
        return row["material_id"], row["name"]

    return None, material_name