"""Typed row models for the domain schema.

These are the boundary between raw sqlite3.Row objects and the rest of the
codebase — nothing outside app/database/ should touch a raw Row.
"""

from __future__ import annotations

import sqlite3

from pydantic import BaseModel


class Material(BaseModel):
    material_id: str
    name: str
    category: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Material":
        return cls(**dict(row))


class Factory(BaseModel):
    factory_id: str
    factory_name: str
    industry: str
    location: str
    latitude: float
    longitude: float
    capacity_tonnes_per_month: float
    transportation_rate_per_km: float
    notes: str | None = None

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Factory":
        return cls(**dict(row))


class AcceptedMaterial(BaseModel):
    factory_id: str
    material_id: str
    moisture_limit_percent: float | None
    purity_requirement_percent: float | None
    purchase_price_per_tonne: float
    processing_cost_per_tonne: float

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "AcceptedMaterial":
        return cls(**dict(row))


class RejectedMaterial(BaseModel):
    factory_id: str
    material_id: str
    reason: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "RejectedMaterial":
        return cls(**dict(row))


class ProcessingRoute(BaseModel):
    route_id: str
    processor_factory_id: str
    input_material_id: str
    output_material_id: str
    output_moisture_percent: float | None
    output_purity_percent: float | None
    processing_cost_per_tonne: float
    description: str | None = None

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "ProcessingRoute":
        return cls(**dict(row))


class FactoryDetail(BaseModel):
    """Aggregated view: a factory plus everything it accepts/rejects/processes.

    This is what GET /api/factories/{id} returns, and what the Discovery
    Agent will load per candidate in Phase 4.
    """

    factory: Factory
    accepted: list[AcceptedMaterial] = []
    rejected: list[RejectedMaterial] = []
    processing: list[ProcessingRoute] = []