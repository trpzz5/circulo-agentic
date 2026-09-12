"""GET /api/factories, GET /api/factories/{id}, GET /api/materials."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.api.schemas.factories import (
    AcceptedMaterialOut,
    FactoryDetailOut,
    FactoryOut,
    MaterialOut,
    ProcessingRouteOut,
    RejectedMaterialOut,
)
from app.database import get_db

router = APIRouter(tags=["factories"])


@router.get("/materials", response_model=list[MaterialOut], summary="List the material catalog")
def list_materials(db: sqlite3.Connection = Depends(get_db)) -> list[MaterialOut]:
    rows = db.execute("SELECT material_id, name, category FROM materials ORDER BY name").fetchall()
    return [MaterialOut(**dict(r)) for r in rows]


@router.get("/factories", response_model=list[FactoryOut], summary="List all industrial entities")
def list_factories(db: sqlite3.Connection = Depends(get_db)) -> list[FactoryOut]:
    rows = db.execute(
        """
        SELECT factory_id, factory_name, industry, location, latitude, longitude,
               capacity_tonnes_per_month, transportation_rate_per_km, notes
        FROM factories
        ORDER BY factory_name
        """
    ).fetchall()
    return [FactoryOut(**dict(r)) for r in rows]


@router.get(
    "/factories/{factory_id}",
    response_model=FactoryDetailOut,
    summary="Get one factory with everything it accepts, rejects, and can process",
)
def get_factory(factory_id: str, db: sqlite3.Connection = Depends(get_db)) -> FactoryDetailOut:
    factory_row = db.execute(
        """
        SELECT factory_id, factory_name, industry, location, latitude, longitude,
               capacity_tonnes_per_month, transportation_rate_per_km, notes
        FROM factories WHERE factory_id = ?
        """,
        (factory_id,),
    ).fetchone()

    if factory_row is None:
        raise HTTPException(status_code=404, detail=f"Factory '{factory_id}' not found.")

    accepted_rows = db.execute(
        """
        SELECT fam.material_id, m.name AS material_name, fam.moisture_limit_percent,
               fam.purity_requirement_percent, fam.purchase_price_per_tonne,
               fam.processing_cost_per_tonne
        FROM factory_accepted_materials fam
        JOIN materials m ON m.material_id = fam.material_id
        WHERE fam.factory_id = ?
        """,
        (factory_id,),
    ).fetchall()

    rejected_rows = db.execute(
        """
        SELECT frm.material_id, m.name AS material_name, frm.reason
        FROM factory_rejected_materials frm
        JOIN materials m ON m.material_id = frm.material_id
        WHERE frm.factory_id = ?
        """,
        (factory_id,),
    ).fetchall()

    processing_rows = db.execute(
        """
        SELECT pr.route_id, pr.input_material_id, mi.name AS input_material_name,
               pr.output_material_id, mo.name AS output_material_name,
               pr.output_moisture_percent, pr.output_purity_percent,
               pr.processing_cost_per_tonne, pr.description
        FROM processing_routes pr
        JOIN materials mi ON mi.material_id = pr.input_material_id
        JOIN materials mo ON mo.material_id = pr.output_material_id
        WHERE pr.processor_factory_id = ?
        """,
        (factory_id,),
    ).fetchall()

    return FactoryDetailOut(
        **dict(factory_row),
        accepted=[AcceptedMaterialOut(**dict(r)) for r in accepted_rows],
        rejected=[RejectedMaterialOut(**dict(r)) for r in rejected_rows],
        processing=[ProcessingRouteOut(**dict(r)) for r in processing_rows],
    )