"""The four agent endpoints.

Each agent is independently invocable — useful for debugging and for a
step-by-step demo mode. Phase 7 adds POST /api/analyze to chain all four.

Note: routes contain NO agent logic. They validate, delegate, and return.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.agents import decision_agent, discovery_agent, dna_agent, impact_agent
from app.api.schemas.agents import (
    DecisionRequest, DecisionResponse,
    DiscoveryRequest, DiscoveryResponse,
    DNARequest, DNAResponse,
    ImpactRequest, ImpactResponse,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post(
    "/dna",
    response_model=DNAResponse,
    status_code=status.HTTP_200_OK,
    summary="Agent 1 — extract Waste DNA",
)
async def run_dna_agent(payload: DNARequest) -> DNAResponse:
    return await dna_agent.run(payload, run_id=payload.run_id)


@router.post(
    "/discovery",
    response_model=DiscoveryResponse,
    summary="Agent 2 — discover direct and multi-hop routes",
)
async def run_discovery_agent(payload: DiscoveryRequest) -> DiscoveryResponse:
    return await discovery_agent.run(payload, run_id=payload.run_id)


@router.post(
    "/impact",
    response_model=ImpactResponse,
    summary="Agent 3 — deterministic economic and CO2 calculations",
)
async def run_impact_agent(payload: ImpactRequest) -> ImpactResponse:
    return await impact_agent.run(payload, run_id=payload.run_id)


@router.post(
    "/decision",
    response_model=DecisionResponse,
    summary="Agent 4 — memory-aware route recommendation",
)
async def run_decision_agent(payload: DecisionRequest) -> DecisionResponse:
    return await decision_agent.run(payload, run_id=payload.run_id)