"""Request/response models for the four agent endpoints.

Each agent is individually invocable (useful for debugging and for the
frontend's step-by-step demo mode); Phase 7 adds /api/analyze to chain them.
Phase 9 adds /api/simulate — the what-if endpoint reuses these same request/
response shapes so Discovery, Impact and Decision behave identically whether
they're driven by a real manifest or a slider the user is dragging.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.api.schemas.common import AgentResponse, TracedValue
from app.api.schemas.waste import WasteDNA


# ── Agent 1: Data & DNA ────────────────────────────────────────────────────

class DNARequest(BaseModel):
    """Raw perception input. Exactly one source should be provided."""
    raw_text: str | None = Field(default=None, description="Pasted manifest text.")
    manifest_id: str | None = Field(default=None, description="Previously uploaded PDF.")
    run_id: str | None = None


DNAResponse = AgentResponse[WasteDNA]


# ── Agent 2: Discovery ─────────────────────────────────────────────────────

class DiscoveryRequest(BaseModel):
    waste_dna: WasteDNA
    max_hops: int = Field(default=2, ge=1, le=3, description="1 = direct only.")
    max_radius_km: float = Field(default=500.0, gt=0)
    run_id: str | None = None


class DiscoveryPayload(BaseModel):
    """Phase 4 fills this in. Shape fixed now so the UI can be built early."""
    direct_matches: list[dict[str, Any]] = Field(default_factory=list)
    multi_hop_routes: list[dict[str, Any]] = Field(default_factory=list)
    candidates_evaluated: int = 0


DiscoveryResponse = AgentResponse[DiscoveryPayload]


# ── Agent 3: Impact ────────────────────────────────────────────────────────

class ImpactRequest(BaseModel):
    waste_dna: WasteDNA
    routes: list[dict[str, Any]] = Field(default_factory=list)
    run_id: str | None = None


class ImpactPayload(BaseModel):
    """Every number is a TracedValue. There is no plain float here by design."""
    per_route: list[dict[str, Any]] = Field(default_factory=list)
    ecosystem_value: TracedValue | None = None
    co2_saved: TracedValue | None = None


ImpactResponse = AgentResponse[ImpactPayload]


# ── Agent 4: Decision ──────────────────────────────────────────────────────

class DecisionRequest(BaseModel):
    waste_dna: WasteDNA
    routes: list[dict[str, Any]] = Field(default_factory=list)
    impact: dict[str, Any] = Field(default_factory=dict)
    run_id: str | None = None
    persist_to_memory: bool = Field(
        default=True,
        description=(
            "True for a real /api/analyze run — the decision is written to "
            "persistent memory as precedent for future runs. False for a "
            "/api/simulate what-if run: memory is still READ for context, "
            "but the hypothetical outcome is never written back, so dragging "
            "a slider can never fabricate a fake track record."
        ),
    )


class DecisionPayload(BaseModel):
    recommended_route_id: str | None = None
    rejected_routes: list[dict[str, Any]] = Field(default_factory=list)
    debate: list[str] = Field(
        default_factory=list,
        description="Concise user-facing reasoning lines for the UI panel.",
    )
    memory_hits: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Persistent-memory records that influenced the decision.",
    )
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


DecisionResponse = AgentResponse[DecisionPayload]


# ── Phase 9: What-If Simulator ──────────────────────────────────────────────

class SimulateRequest(BaseModel):
    """Re-run Discovery -> Impact -> Decision against an adjusted Waste DNA.

    Skips the DNA agent entirely (the manifest is already structured — the
    user is dragging sliders, not uploading a new PDF) and never persists to
    memory (see DecisionRequest.persist_to_memory above).
    """
    waste_dna: WasteDNA
    max_hops: int = Field(default=2, ge=1, le=3)


class SimulateResponse(BaseModel):
    waste_dna: WasteDNA
    discovery: DiscoveryResponse
    impact: ImpactResponse
    decision: DecisionResponse