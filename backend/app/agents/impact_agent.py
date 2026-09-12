"""Agent 3 — Impact Agent (deterministic tool-use).

PHASE 1 STUB. Real calculations land in Phase 5.

INVARIANT: this agent must only ever emit ExecutionSource.DETERMINISTIC.
No LLM is permitted to produce or adjust a number here, ever.
"""

from __future__ import annotations

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import ImpactPayload, ImpactRequest
from app.api.schemas.common import AgentName, ExecutionSource


class ImpactAgent(BaseAgent[ImpactRequest, ImpactPayload]):
    name = AgentName.IMPACT
    activity_label = "CALCULATING"
    description = (
        "Computes transport, processing, CO2 and ecosystem value using pure "
        "Python functions. Every number ships with its formula and inputs."
    )

    async def execute(
        self, payload: ImpactRequest, run_id: str
    ) -> AgentResult[ImpactPayload]:
        return AgentResult(
            data=ImpactPayload(),
            source=ExecutionSource.STUB,
            notes=[
                "Phase 1 stub — deterministic calculation tools arrive in Phase 5.",
                f"Received {len(payload.routes)} route(s) for costing.",
            ],
        )