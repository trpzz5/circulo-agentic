"""CIRCULO — Agentic Industrial Symbiosis Engine. FastAPI entrypoint.

Run from the `backend/` directory:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.api.schemas.common import ErrorResponse, Severity
from app.config import get_settings
from app.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("circulo")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown. Startup failures are fatal and loud — never silent."""
    logger.info("=" * 68)
    logger.info("  %s v%s — %s", settings.app_name, settings.version, settings.app_tagline)
    logger.info("  environment      : %s", settings.environment)
    logger.info("  deterministic    : %s", settings.deterministic_mode)
    logger.info("  llm available    : %s", settings.llm_available)
    logger.info("  database         : %s", settings.resolved_database_path)
    logger.info("=" * 68)

    try:
        init_db()
    except Exception:
        logger.exception("FATAL: database initialisation failed")
        raise

    try:
        from app.memory.memory_store import seed_if_empty
        seed_if_empty()
    except Exception:
        logger.exception("FATAL: memory store initialisation failed")
        raise

    yield
    logger.info("CIRCULO shutting down.")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Autonomous multi-agent engine that discovers direct and multi-hop "
        "circular supply chains for industrial waste streams."
    ),
    version=settings.version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id and duration to every response.

    The id appears in logs and in every error body, so a judge's screenshot of
    a failure can be traced to an exact log line.
    """
    request_id = uuid4().hex[:12]
    request.state.request_id = request_id
    started = time.perf_counter()

    response = await call_next(request)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(elapsed_ms)
    logger.info(
        "%s %s -> %s (%dms) [%s]",
        request.method, request.url.path, response.status_code, elapsed_ms, request_id,
    )
    return response


# ── Exception handlers: one consistent error shape, always ─────────────────

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error="Request validation failed.",
            error_type="ValidationError",
            request_id=getattr(request.state, "request_id", None),
            severity=Severity.WARNING,
            context={"issues": exc.errors()},
        ).model_dump(mode="json"),
    )


@app.exception_handler(StarletteHTTPException)
async def http_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=str(exc.detail),
            error_type="HTTPException",
            request_id=getattr(request.state, "request_id", None),
            severity=Severity.WARNING if exc.status_code < 500 else Severity.CRITICAL,
        ).model_dump(mode="json"),
    )


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    """Last line of defence. Logged with a full traceback — never swallowed."""
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error.",
            error_type=type(exc).__name__,
            request_id=getattr(request.state, "request_id", None),
            severity=Severity.CRITICAL,
        ).model_dump(mode="json"),
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", tags=["system"], summary="Service banner")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "tagline": settings.app_tagline,
        "version": settings.version,
        "docs": "/docs",
        "health": f"{settings.api_prefix}/health",
    }