"""GET /api/health — truthful system status for judges, teammates and Docker."""

from __future__ import annotations

from fastapi import APIRouter

from app.agents import AGENT_REGISTRY, PIPELINE_ORDER
from app.api.schemas.common import ComponentHealth, HealthResponse
from app.config import get_settings
from app.database import check_database

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="System health")
def health() -> HealthResponse:
    settings = get_settings()

    db_ok, db_detail = check_database()
    components = [
        ComponentHealth(name="sqlite", healthy=db_ok, detail=db_detail),
        ComponentHealth(
            name="agents",
            healthy=len(AGENT_REGISTRY) == 4,
            detail=f"{len(AGENT_REGISTRY)}/4 agents registered",
        ),
        ComponentHealth(
            name="llm",
            healthy=True,  # optional by design — absence is never unhealthy
            detail=("enabled" if settings.llm_available
                    else "disabled (deterministic mode)"),
        ),
    ]

    return HealthResponse(
        status="ok" if all(c.healthy for c in components) else "degraded",
        app=settings.app_name,
        version=settings.version,
        environment=settings.environment,
        deterministic_mode=settings.deterministic_mode,
        llm_available=settings.llm_available,
        components=components,
        agents=list(PIPELINE_ORDER),
    )


@router.get("/agents", tags=["agents"], summary="Agent roster")
def list_agents() -> dict[str, object]:
    """Metadata for the frontend's agent status rail."""
    return {
        "pipeline": [a.value for a in PIPELINE_ORDER],
        "agents": [AGENT_REGISTRY[a].describe() for a in PIPELINE_ORDER],
    }