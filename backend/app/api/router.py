"""Aggregates every route module into one router.

main.py includes exactly one router, so adding endpoints in later phases
never requires editing main.py.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import agents, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(agents.router)

# Phase 2: api_router.include_router(factories.router)
# Phase 3: api_router.include_router(upload.router)
# Phase 7: api_router.include_router(stream.router)