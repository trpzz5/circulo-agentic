"""GET /api/memory — read-only view of persistent agent memory."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.schemas.factories import MemoryRecordOut
from app.memory.memory_store import list_records

router = APIRouter(tags=["memory"])


@router.get("/memory", response_model=list[MemoryRecordOut], summary="List persistent memory records")
def get_memory(
    factory_id: str | None = Query(default=None, description="Filter by factory."),
    material_id: str | None = Query(default=None, description="Filter by material."),
) -> list[MemoryRecordOut]:
    records = list_records()
    if factory_id:
        records = [r for r in records if r["factory_id"] == factory_id]
    if material_id:
        records = [r for r in records if r["material_id"] == material_id]
    return [MemoryRecordOut(**r) for r in records]