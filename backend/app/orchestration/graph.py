"""Custom async orchestration — a LangGraph-shaped pipeline without the
LangGraph dependency itself (Phase 1 decision: lower latency, fewer moving
parts, easier to debug live on stage).

Runs DNA -> Discovery -> Impact -> Decision sequentially, emitting a status
event before and after every agent so the frontend's status rail can render
WAITING -> RUNNING -> COMPLETE / FAILED / SKIPPED in real time.

Never raises: a failed agent still produces a full result with that agent's
status set to FAILED, and any agent that structurally cannot proceed (e.g.
Discovery with no Waste DNA to search from) is marked SKIPPED rather than
crashing the whole run.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from app.agents import PIPELINE_ORDER, decision_agent, discovery_agent, dna_agent, impact_agent
from app.api.schemas.agents import DecisionRequest, DiscoveryRequest, DNARequest, ImpactRequest
from app.api.schemas.common import AgentStatus

logger = logging.getLogger(__name__)


@dataclass
class PipelineEvent:
    run_id: str
    agent: str
    status: str
    activity: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    note: str | None = None
    data: dict | None = None

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id, "agent": self.agent, "status": self.status,
            "activity": self.activity, "timestamp": self.timestamp,
            "note": self.note, "data": self.data,
        }


EventSink = Callable[[PipelineEvent], None]


async def run_pipeline(
    *, run_id: str, raw_text: str | None, manifest_id: str | None, max_hops: int, emit: EventSink,
) -> dict[str, Any]:
    result: dict[str, Any] = {"run_id": run_id, "agents": {}}

    for name in PIPELINE_ORDER:
        emit(PipelineEvent(run_id=run_id, agent=name.value, status=AgentStatus.WAITING.value, activity="WAITING"))

    # ── 1. DNA ────────────────────────────────────────────────────────────
    emit(PipelineEvent(run_id=run_id, agent="dna", status="running", activity=dna_agent.activity_label))
    dna_response = await dna_agent.run(
        DNARequest(raw_text=raw_text, manifest_id=manifest_id, run_id=run_id), run_id=run_id
    )
    result["agents"]["dna"] = dna_response.model_dump(mode="json")
    emit(PipelineEvent(
        run_id=run_id, agent="dna", status=dna_response.status.value, activity=dna_response.activity,
        note=(dna_response.notes[-1] if dna_response.notes else None),
        data=dna_response.data.model_dump(mode="json") if dna_response.data else None,
    ))

    waste_dna = dna_response.data
    if waste_dna is None:
        for agent_name in ("discovery", "impact", "decision"):
            emit(PipelineEvent(
                run_id=run_id, agent=agent_name, status=AgentStatus.SKIPPED.value, activity="SKIPPED",
                note="Skipped — DNA agent failed to produce Waste DNA.",
            ))
        emit(PipelineEvent(run_id=run_id, agent="pipeline", status="failed", activity="FAILED",
                            note="DNA agent failed unexpectedly."))
        return result

    # ── 2. Discovery ─────────────────────────────────────────────────────
    emit(PipelineEvent(run_id=run_id, agent="discovery", status="running", activity=discovery_agent.activity_label))
    discovery_response = await discovery_agent.run(
        DiscoveryRequest(waste_dna=waste_dna, max_hops=max_hops, run_id=run_id), run_id=run_id
    )
    result["agents"]["discovery"] = discovery_response.model_dump(mode="json")
    emit(PipelineEvent(
        run_id=run_id, agent="discovery", status=discovery_response.status.value, activity=discovery_response.activity,
        note=(discovery_response.notes[-1] if discovery_response.notes else None),
    ))

    if discovery_response.data is None:
        for agent_name in ("impact", "decision"):
            emit(PipelineEvent(
                run_id=run_id, agent=agent_name, status=AgentStatus.SKIPPED.value, activity="SKIPPED",
                note="Skipped — Discovery agent failed to produce candidates.",
            ))
        emit(PipelineEvent(run_id=run_id, agent="pipeline", status="failed", activity="FAILED",
                            note="Discovery agent failed unexpectedly."))
        return result

    all_routes: list[dict] = list(discovery_response.data.direct_matches) + list(discovery_response.data.multi_hop_routes)

    # ── 3. Impact ────────────────────────────────────────────────────────
    emit(PipelineEvent(run_id=run_id, agent="impact", status="running", activity=impact_agent.activity_label))
    impact_response = await impact_agent.run(
        ImpactRequest(waste_dna=waste_dna, routes=all_routes, run_id=run_id), run_id=run_id
    )
    result["agents"]["impact"] = impact_response.model_dump(mode="json")
    emit(PipelineEvent(
        run_id=run_id, agent="impact", status=impact_response.status.value, activity=impact_response.activity,
        note=(impact_response.notes[-1] if impact_response.notes else None),
    ))

    impact_data = impact_response.data.model_dump(mode="json") if impact_response.data else {}

    # ── 4. Decision ──────────────────────────────────────────────────────
    emit(PipelineEvent(run_id=run_id, agent="decision", status="running", activity=decision_agent.activity_label))
    decision_response = await decision_agent.run(
        DecisionRequest(waste_dna=waste_dna, routes=all_routes, impact=impact_data, run_id=run_id), run_id=run_id
    )
    result["agents"]["decision"] = decision_response.model_dump(mode="json")
    emit(PipelineEvent(
        run_id=run_id, agent="decision", status=decision_response.status.value, activity=decision_response.activity,
        note=(decision_response.notes[-1] if decision_response.notes else None),
        data=decision_response.data.model_dump(mode="json") if decision_response.data else None,
    ))

    emit(PipelineEvent(run_id=run_id, agent="pipeline", status="complete", activity="COMPLETE", note="Analysis complete."))
    return result