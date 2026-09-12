"""Shared API contracts.

Everything the frontend renders comes through the types in this file. Define
them once, correctly, and Phases 3-9 become fill-in-the-blank work.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Generic, TypeVar
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

TPayload = TypeVar("TPayload")


# ══════════════════════════════════════════════════════════════════════════
#  Enumerations
# ══════════════════════════════════════════════════════════════════════════

class AgentName(str, Enum):
    """Stable machine identifiers. The UI maps these to display names."""
    DNA = "dna"
    DISCOVERY = "discovery"
    IMPACT = "impact"
    DECISION = "decision"


class AgentStatus(str, Enum):
    """Lifecycle of a single agent within one analysis run.

    Drives the command-center status rail:
        WAITING -> RUNNING -> COMPLETE | FAILED | SKIPPED
    """
    WAITING = "waiting"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    SKIPPED = "skipped"


class ExecutionSource(str, Enum):
    """Provenance of a result. Rendered as a badge in the UI.

    DETERMINISTIC — produced purely by Python logic / SQL. Reproducible.
    LLM_ASSISTED  — an LLM shaped prose or extraction; numbers still deterministic.
    FALLBACK      — the preferred path failed; a deterministic fallback ran.
    STUB          — placeholder, not yet implemented (Phase 1 only).

    The Impact Agent MUST only ever emit DETERMINISTIC.
    """
    DETERMINISTIC = "deterministic"
    LLM_ASSISTED = "llm_assisted"
    FALLBACK = "fallback"
    STUB = "stub"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ══════════════════════════════════════════════════════════════════════════
#  Auditable numbers  — the [View Calculation] contract
# ══════════════════════════════════════════════════════════════════════════

class TracedValue(BaseModel):
    """A number that can prove where it came from.

    NO numeric value may cross the API boundary without this wrapper.
    This is the structural guarantee that the Impact Agent's output is
    verifiable rather than hallucinated.
    """

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "metric": "Transportation Cost",
            "value": 4200.0,
            "unit": "INR",
            "formula": "distance_km * rate_per_km",
            "inputs": {"distance_km": 140, "rate_per_km": 30},
            "breakdown": ["140 km x Rs.30/km = Rs.4,200"],
        }
    })

    metric: str = Field(..., description="Human-readable metric name.")
    value: float = Field(..., description="The computed result.")
    unit: str = Field(default="INR", description="INR | kg_co2e | tonnes | km | %")
    formula: str = Field(..., description="The literal expression evaluated.")
    inputs: dict[str, float | int | str] = Field(
        default_factory=dict, description="Every input that fed the formula."
    )
    breakdown: list[str] = Field(
        default_factory=list, description="Step-by-step lines for the modal."
    )
    source: ExecutionSource = Field(
        default=ExecutionSource.DETERMINISTIC,
        description="Always DETERMINISTIC for real calculations.",
    )


# ══════════════════════════════════════════════════════════════════════════
#  The universal agent envelope
# ══════════════════════════════════════════════════════════════════════════

def new_run_id() -> str:
    """Correlation id tying the four agents of one analysis together."""
    return f"run_{uuid4().hex[:12]}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AgentResponse(BaseModel, Generic[TPayload]):
    """Uniform result shape for every agent, success or failure.

    The frontend renders agent cards, the timeline and the event stream from
    this single shape — so the UI is written once and never changes as agents
    gain real logic in Phases 3-6.
    """

    run_id: str = Field(default_factory=new_run_id)
    agent: AgentName
    status: AgentStatus
    activity: str = Field(
        ..., description="Present-tense label for the UI, e.g. 'SEARCHING'."
    )
    source: ExecutionSource = ExecutionSource.DETERMINISTIC
    started_at: datetime = Field(default_factory=utc_now)
    duration_ms: int = 0
    data: TPayload | None = Field(
        default=None, description="Agent-specific payload; None when failed."
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Concise, user-facing reasoning lines. NOT chain-of-thought.",
    )
    error: str | None = Field(
        default=None, description="Populated only when status is FAILED."
    )

    @property
    def ok(self) -> bool:
        return self.status is AgentStatus.COMPLETE


# ══════════════════════════════════════════════════════════════════════════
#  Health
# ══════════════════════════════════════════════════════════════════════════

class ComponentHealth(BaseModel):
    name: str
    healthy: bool
    detail: str


class HealthResponse(BaseModel):
    status: str = Field(..., description="ok | degraded")
    app: str
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=utc_now)
    deterministic_mode: bool
    llm_available: bool
    components: list[ComponentHealth] = Field(default_factory=list)
    agents: list[AgentName] = Field(default_factory=list)


# ══════════════════════════════════════════════════════════════════════════
#  Errors
# ══════════════════════════════════════════════════════════════════════════

class ErrorResponse(BaseModel):
    """Every non-2xx response uses this shape. No bare FastAPI 'detail' strings."""
    error: str
    error_type: str
    request_id: str | None = None
    severity: Severity = Severity.CRITICAL
    context: dict[str, Any] = Field(default_factory=dict)