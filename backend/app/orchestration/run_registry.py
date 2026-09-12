"""In-memory registry of orchestrated pipeline runs — powers the SSE event
stream. Deliberately NOT persisted across restarts: this is live demo state
(who's watching what, right now), not domain data — that still lives in
SQLite and the JSON memory store as before.

Supports multiple simultaneous SSE subscribers per run (e.g. two browser
tabs watching the same analysis) via per-subscriber queues fed by a single
fan-out broadcast on every emit.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RunState:
    run_id: str
    status: str = "running"  # running | complete | failed
    events: list[dict] = field(default_factory=list)
    subscribers: list[asyncio.Queue] = field(default_factory=list)
    result: dict[str, Any] | None = None


_runs: dict[str, RunState] = {}


def create_run(run_id: str) -> RunState:
    state = RunState(run_id=run_id)
    _runs[run_id] = state
    return state


def get_run(run_id: str) -> RunState | None:
    return _runs.get(run_id)


def subscribe(run_id: str) -> asyncio.Queue | None:
    state = _runs.get(run_id)
    if state is None:
        return None
    queue: asyncio.Queue = asyncio.Queue()
    state.subscribers.append(queue)
    return queue


def unsubscribe(run_id: str, queue: asyncio.Queue) -> None:
    state = _runs.get(run_id)
    if state and queue in state.subscribers:
        state.subscribers.remove(queue)


def emit_event(run_id: str, event: dict) -> None:
    state = _runs.get(run_id)
    if state is None:
        return
    state.events.append(event)
    for queue in state.subscribers:
        queue.put_nowait(event)


def complete_run(run_id: str, result: dict[str, Any]) -> None:
    state = _runs.get(run_id)
    if state is None:
        return
    state.status = "complete"
    state.result = result
    for queue in state.subscribers:
        queue.put_nowait(None)


def fail_run(run_id: str, error: str) -> None:
    state = _runs.get(run_id)
    if state is None:
        return
    state.status = "failed"
    state.result = {"error": error}
    for queue in state.subscribers:
        queue.put_nowait(None)