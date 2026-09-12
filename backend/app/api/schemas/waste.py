"""Waste DNA — the canonical description of an industrial waste stream.

Produced by Agent 1, consumed by Agents 2-4. Strict validation here is what
guarantees Agent 1 can never return unstructured prose where data is required.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WasteDNA(BaseModel):
    """Structured fingerprint of a waste stream."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "material": "Foundry Sand",
            "quantity_tonnes_per_month": 20.0,
            "moisture_percent": 12.0,
            "purity_percent": 94.0,
            "embedded_carbon_kg_co2e": 1200.0,
            "location": "Mangalore",
            "source_factory": "ABC Foundry",
        }
    })

    material: str = Field(..., min_length=2, max_length=120)
    quantity_tonnes_per_month: float = Field(..., gt=0, le=100_000)
    moisture_percent: float = Field(..., ge=0, le=100)
    purity_percent: float = Field(..., ge=0, le=100)
    embedded_carbon_kg_co2e: float = Field(default=0.0, ge=0)
    location: str = Field(..., min_length=2, max_length=120)
    source_factory: str = Field(..., min_length=2, max_length=160)

    # Provenance — populated by the DNA agent in Phase 3.
    manifest_id: str | None = None
    extraction_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    hazard_class: str | None = None


class ManifestUploadResponse(BaseModel):
    """Returned immediately after upload — extraction only, no DNA yet."""
    manifest_id: str
    filename: str
    page_count: int
    character_count: int
    text_preview: str = Field(..., description="First ~300 chars of extracted text.")
    likely_unreadable: bool = Field(
        ..., description="True if almost no text was extracted (e.g. a scanned image)."
    )