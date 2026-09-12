"""POST /api/simulate — Phase 9 what-if simulator.

Re-runs Discovery -> Impact -> Decision against a manifest the user is
interactively adjusting (sliders for quantity/moisture/purity in the
frontend's What-If panel). Deliberately skips the DNA agent — the manifest
is already structured, there's no PDF/text to extract — and always sets
`persist_to_memory=False` on the Decision Agent so hypothetical exploration
can never write a fake outcome into persistent memory. A real, "I actually
want to run this manifest" analysis still goes through /api/analyze, which
persists exactly as before.

Synchronous by design (no run_id registry, no SSE stream): the frontend
calls this on every slider change and expects the graph/decision panel to
update within a couple hundred ms, not to sit through the full agent-status
choreography meant for the primary demo flow.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.agents import decision_agent, discovery_agent, impact_agent
from app.api.schemas.agents import (
    DecisionRequest,
    DiscoveryRequest,
    ImpactRequest,
    SimulateRequest,
    SimulateResponse,
)
from app.api.schemas.common import new_run_id

logger = logging.getLogger(__name__)
router = APIRouter(tags=["orchestration"])


@router.post(
    "/simulate",
    response_model=SimulateResponse,
    summary="What-if: recompute routes for an adjusted manifest (never persisted to memory)",
)
async def simulate(payload: SimulateRequest) -> SimulateResponse:
    # Ephemeral id for logging/tracing only — never registered in the run
    # registry, never streamed, never visible to /api/routes/{run_id}.
    run_id = f"sim_{new_run_id().removeprefix('run_')}"

    discovery_response = await discovery_agent.run(
        DiscoveryRequest(waste_dna=payload.waste_dna, max_hops=payload.max_hops, run_id=run_id),
        run_id=run_id,
    )

    all_routes: list[dict] = []
    if discovery_response.data is not None:
        all_routes = list(discovery_response.data.direct_matches) + list(
            discovery_response.data.multi_hop_routes
        )

    impact_response = await impact_agent.run(
        ImpactRequest(waste_dna=payload.waste_dna, routes=all_routes, run_id=run_id),
        run_id=run_id,
    )
    impact_data = impact_response.data.model_dump(mode="json") if impact_response.data else {}

    decision_response = await decision_agent.run(
        DecisionRequest(
            waste_dna=payload.waste_dna,
            routes=all_routes,
            impact=impact_data,
            run_id=run_id,
            persist_to_memory=False,
        ),
        run_id=run_id,
    )

    logger.info(
        "[%s] simulate: quantity=%.1f moisture=%.1f purity=%.1f -> recommended=%s",
        run_id,
        payload.waste_dna.quantity_tonnes_per_month,
        payload.waste_dna.moisture_percent,
        payload.waste_dna.purity_percent,
        decision_response.data.recommended_route_id if decision_response.data else None,
    )

    return SimulateResponse(
        waste_dna=payload.waste_dna,
        discovery=discovery_response,
        impact=impact_response,
        decision=decision_response,
    )