"""API response models for factory and memory endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class MaterialOut(BaseModel):
    material_id: str
    name: str
    category: str


class AcceptedMaterialOut(BaseModel):
    material_id: str
    material_name: str
    moisture_limit_percent: float | None
    purity_requirement_percent: float | None
    purchase_price_per_tonne: float
    processing_cost_per_tonne: float


class RejectedMaterialOut(BaseModel):
    material_id: str
    material_name: str
    reason: str


class ProcessingRouteOut(BaseModel):
    route_id: str
    input_material_id: str
    input_material_name: str
    output_material_id: str
    output_material_name: str
    output_moisture_percent: float | None
    output_purity_percent: float | None
    processing_cost_per_tonne: float
    description: str | None


class FactoryOut(BaseModel):
    factory_id: str
    factory_name: str
    industry: str
    location: str
    latitude: float
    longitude: float
    capacity_tonnes_per_month: float
    transportation_rate_per_km: float
    notes: str | None


class FactoryDetailOut(FactoryOut):
    accepted: list[AcceptedMaterialOut] = []
    rejected: list[RejectedMaterialOut] = []
    processing: list[ProcessingRouteOut] = []


class MemoryRecordOut(BaseModel):
    id: str
    factory_id: str
    factory_name: str
    material_id: str
    material_name: str
    source_factory: str
    outcome: str
    reason: str
    limit_percent: float | None = None
    observed_percent: float | None = None
    date: str
    notes: str = ""