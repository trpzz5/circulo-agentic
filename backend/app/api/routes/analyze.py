"""POST /api/analyze — orchestrates DNA -> Discovery -> Impact -> Decision
as one real-time pipeline.

GET /api/stream/{run_id} streams live agent events via Server-Sent Events.

GET /api/routes/{run_id} fetches the finished result.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.schemas.common import new_run_id
from app.orchestration.graph import run_pipeline
from app.orchestration.run_registry import (
    complete_run,
    create_run,
    emit_event,
    fail_run,
    get_run,
    subscribe,
    unsubscribe,
)


logger = logging.getLogger(__name__)

router = APIRouter(tags=["orchestration"])


class AnalyzeRequest(BaseModel):
    raw_text: str | None = None
    manifest_id: str | None = None
    max_hops: int = Field(default=2, ge=1, le=3)
    run_id: str | None = None


class AnalyzeAck(BaseModel):
    run_id: str
    status: str
    stream_url: str
    result_url: str


@router.post(
    "/analyze",
    response_model=AnalyzeAck,
    summary="Run the full 4-agent pipeline",
)
async def analyze(payload: AnalyzeRequest) -> AnalyzeAck:
    """Start a real CIRCULO analysis pipeline."""

    run_id = payload.run_id or new_run_id()

    create_run(run_id)

    async def _background() -> None:
        try:
            result = await run_pipeline(
                run_id=run_id,
                raw_text=payload.raw_text,
                manifest_id=payload.manifest_id,
                max_hops=payload.max_hops,
                emit=lambda event: emit_event(
                    run_id,
                    event.to_dict(),
                ),
            )

            complete_run(run_id, result)

        except Exception as exc:
            logger.exception("[%s] pipeline crashed", run_id)
            fail_run(
                run_id,
                f"{type(exc).__name__}: {exc}",
            )

    # Run the pipeline asynchronously so the POST returns immediately
    # with the run ID and SSE stream URLs.
    asyncio.create_task(_background())

    return AnalyzeAck(
        run_id=run_id,
        status="started",
        stream_url=f"/api/stream/{run_id}",
        result_url=f"/api/routes/{run_id}",
    )


@router.get(
    "/stream/{run_id}",
    summary="Server-Sent Events for one pipeline run",
)
async def stream(run_id: str):
    """Stream pipeline events for one analysis run."""

    state = get_run(run_id)

    if state is None:
        raise HTTPException(
            status_code=404,
            detail=f"No run with id '{run_id}'.",
        )

    queue = subscribe(run_id)

    async def event_generator():
        try:
            # Send events that happened before the client subscribed.
            for event in list(state.events):
                yield f"data: {json.dumps(event)}\n\n"

            if state.status != "running":
                yield "event: done\ndata: {}\n\n"
                return

            # Continue streaming newly emitted events.
            while True:
                event = await queue.get()

                if event is None:
                    yield "event: done\ndata: {}\n\n"
                    break

                yield f"data: {json.dumps(event)}\n\n"

        finally:
            unsubscribe(run_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.get(
    "/routes/{run_id}",
    summary="Get the full result of one analysis run",
)
async def get_route_result(run_id: str):
    """Return the finished result for an analysis run."""

    state = get_run(run_id)

    if state is None:
        raise HTTPException(
            status_code=404,
            detail=f"No run with id '{run_id}'.",
        )

    return {
        "run_id": run_id,
        "status": state.status,
        "result": state.result,
    }