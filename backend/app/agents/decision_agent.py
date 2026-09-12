"""Agent 4 — Decision Agent (memory + planning + final recommendation).

PHASE 1 STUB. Memory-driven constraint checking lands in Phase 6.
"""

from __future__ import annotations

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DecisionPayload, DecisionRequest
from app.api.schemas.common import AgentName, ExecutionSource


class DecisionAgent(BaseAgent[DecisionRequest, DecisionPayload]):
    name = AgentName.DECISION
    activity_label = "DECIDING"
    description = (
        "Checks persistent memory for prior rejections and constraints, then "
        "selects and justifies the viable circular route."
    )

    async def execute(
        self, payload: DecisionRequest, run_id: str
    ) -> AgentResult[DecisionPayload]:
        return AgentResult(
            data=DecisionPayload(),
            source=ExecutionSource.STUB,
            notes=["Phase 1 stub — persistent memory arrives in Phase 6."],
        )