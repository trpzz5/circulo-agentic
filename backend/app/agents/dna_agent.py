"""Agent 1 — Data & DNA Agent (perception / ingestion).

PHASE 1 STUB. Real extraction lands in Phase 3.
"""

from __future__ import annotations

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DNARequest
from app.api.schemas.common import AgentName, ExecutionSource
from app.api.schemas.waste import WasteDNA

# The Golden Path fixture. In Phase 3 this becomes the deterministic FALLBACK
# used when PDF extraction or the LLM is unavailable — which is exactly what
# makes the live demo survive a dead network.
GOLDEN_PATH_DNA = WasteDNA(
    material="Foundry Sand",
    quantity_tonnes_per_month=20.0,
    moisture_percent=12.0,
    purity_percent=94.0,
    embedded_carbon_kg_co2e=1200.0,
    location="Mangalore",
    source_factory="ABC Foundry",
    extraction_confidence=1.0,
)


class DNAAgent(BaseAgent[DNARequest, WasteDNA]):
    name = AgentName.DNA
    activity_label = "EXTRACTING"
    description = "Parses waste manifests into a strict Waste DNA structure."

    async def execute(self, payload: DNARequest, run_id: str) -> AgentResult[WasteDNA]:
        return AgentResult(
            data=GOLDEN_PATH_DNA,
            source=ExecutionSource.STUB,
            notes=[
                "Phase 1 stub — returning the Golden Path fixture.",
                "Manifest parsing and OCR arrive in Phase 3.",
            ],
        )