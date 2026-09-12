"""Aggregates every route module into one router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import agents, factories, health, memory, upload

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(agents.router)
api_router.include_router(factories.router)
api_router.include_router(memory.router)
api_router.include_router(upload.router)

# Phase 7: api_router.include_router(stream.router)