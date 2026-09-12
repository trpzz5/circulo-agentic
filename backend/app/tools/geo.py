"""Geography helpers — pure functions, no I/O beyond reading the factories table.

Used by the Discovery Agent now (candidate distance/radius filtering) and
reused by the Impact Agent in Phase 5 (transport cost = distance x rate).
Distance calculation must be deterministic — this is exactly the kind of
number that must never come from an LLM.
"""

from __future__ import annotations

import math
import sqlite3

# Representative coordinates for locations that appear in seed data but might
# not have a matching factory row. NOT a geocoding service — a small,
# hand-maintained, demo-safe lookup with a fixed default fallback.
_KNOWN_LOCATIONS: dict[str, tuple[float, float]] = {
    "mangalore": (12.9141, 74.8560),
    "udupi": (13.3409, 74.7421),
    "bantwal": (12.8347, 75.0369),
}

_DEFAULT_COORDS = _KNOWN_LOCATIONS["mangalore"]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def resolve_source_coordinates(
    conn: sqlite3.Connection, source_factory: str, location: str
) -> tuple[float, float, str]:
    """Best-effort location of the waste's origin. Never raises — a missing
    coordinate degrades to 'approximate', it never breaks the pipeline.

    Priority: exact factory-name match > fuzzy match > known town lookup by
    the manifest's location string > fixed default.
    """
    row = conn.execute(
        "SELECT latitude, longitude FROM factories WHERE lower(factory_name) = lower(?)",
        (source_factory,),
    ).fetchone()
    if row:
        return row["latitude"], row["longitude"], "matched_factory_exact"

    row = conn.execute(
        "SELECT latitude, longitude FROM factories WHERE lower(factory_name) LIKE lower(?)",
        (f"%{source_factory}%",),
    ).fetchone()
    if row:
        return row["latitude"], row["longitude"], "matched_factory_fuzzy"

    key = location.strip().lower()
    if key in _KNOWN_LOCATIONS:
        lat, lon = _KNOWN_LOCATIONS[key]
        return lat, lon, "matched_known_location"

    lat, lon = _DEFAULT_COORDS
    return lat, lon, "default_fallback"