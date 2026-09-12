"""BaseAgent — the contract every CIRCULO agent obeys.

Guarantees, for free and identically, across all four agents:
  * accurate wall-clock timing
  * the same AgentResponse envelope
  * exceptions logged with a full traceback, never silently swallowed
  * a failure in one agent degrades the run instead of 500-ing the API
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, ClassVar, Generic, TypeVar

from app.api.schemas.common import (
    AgentName,
    AgentResponse,
    AgentStatus,
    ExecutionSource,
    new_run_id,
    utc_now,
)

logger = logging.getLogger(__name__)

TIn = TypeVar("TIn")
TOut = TypeVar("TOut")


class AgentExecutionError(RuntimeError):
    """Expected, well-understood agent failure (bad input, no match found).

    Distinguished from unexpected exceptions so we can log at WARNING instead
    of ERROR and return a clean user-facing message.
    """


@dataclass(slots=True)
class AgentResult(Generic[TOut]):
    """What a concrete agent's execute() returns, before enveloping."""
    data: TOut
    source: ExecutionSource = ExecutionSource.DETERMINISTIC
    notes: list[str] = field(default_factory=list)


class BaseAgent(ABC, Generic[TIn, TOut]):
    """Subclasses implement execute(); nobody overrides run()."""

    name: ClassVar[AgentName]
    activity_label: ClassVar[str]        # shown while RUNNING, e.g. "SEARCHING"
    description: ClassVar[str] = ""

    @abstractmethod
    async def execute(self, payload: TIn, run_id: str) -> AgentResult[TOut]:
        """Agent logic. Raise AgentExecutionError for expected failures."""
        raise NotImplementedError

    async def run(self, payload: TIn, run_id: str | None = None) -> AgentResponse[TOut]:
        """Public entry point. Times, wraps and never raises."""
        run_id = run_id or new_run_id()
        started_at = utc_now()
        clock = perf_counter()

        def elapsed_ms() -> int:
            return int((perf_counter() - clock) * 1000)

        try:
            result = await self.execute(payload, run_id)

        except AgentExecutionError as exc:
            # Expected failure — e.g. "no compatible destination found".
            logger.warning(
                "[%s] agent=%s expected failure: %s", run_id, self.name.value, exc
            )
            return AgentResponse[TOut](
                run_id=run_id,
                agent=self.name,
                status=AgentStatus.FAILED,
                activity="FAILED",
                started_at=started_at,
                duration_ms=elapsed_ms(),
                error=str(exc),
            )

        except Exception as exc:
            # Unexpected. Log the full traceback — we never hide a bug.
            logger.exception(
                "[%s] agent=%s unhandled error", run_id, self.name.value
            )
            return AgentResponse[TOut](
                run_id=run_id,
                agent=self.name,
                status=AgentStatus.FAILED,
                activity="FAILED",
                started_at=started_at,
                duration_ms=elapsed_ms(),
                error=f"{type(exc).__name__}: {exc}",
            )

        duration = elapsed_ms()
        logger.info(
            "[%s] agent=%s complete in %dms (source=%s)",
            run_id, self.name.value, duration, result.source.value,
        )
        return AgentResponse[TOut](
            run_id=run_id,
            agent=self.name,
            status=AgentStatus.COMPLETE,
            activity="COMPLETE",
            source=result.source,
            started_at=started_at,
            duration_ms=duration,
            data=result.data,
            notes=result.notes,
        )

    def describe(self) -> dict[str, Any]:
        """Metadata for /api/health and the frontend's agent roster."""
        return {
            "name": self.name.value,
            "activity_label": self.activity_label,
            "description": self.description,
        }