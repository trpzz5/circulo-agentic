"""Agent 2 — Discovery Agent (reasoning / opportunity discovery).

PHASE 1 STUB. Compatibility matching + multi-hop search land in Phase 4.
"""

from __future__ import annotations

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DiscoveryPayload, DiscoveryRequest
from app.api.schemas.common import AgentName, ExecutionSource


class DiscoveryAgent(BaseAgent[DiscoveryRequest, DiscoveryPayload]):
    name = AgentName.DISCOVERY
    activity_label = "SEARCHING"
    description = (
        "Discovers direct buyers and multi-hop transformation pathways "
        "across the industrial network."
    )

    async def execute(
        self, payload: DiscoveryRequest, run_id: str
    ) -> AgentResult[DiscoveryPayload]:
        return AgentResult(
            data=DiscoveryPayload(),
            source=ExecutionSource.STUB,
            notes=[
                "Phase 1 stub — the industrial network is seeded in Phase 2.",
                f"Requested max_hops={payload.max_hops}, "
                f"radius={payload.max_radius_km} km.",
            ],
        )