"""Application configuration.

Single source of truth for all tunable values. Nothing anywhere else in the
codebase reads os.environ directly — that keeps configuration auditable and
makes the demo-day kill-switch (DETERMINISTIC_MODE) actually reliable.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> backend/app -> backend
APP_DIR: Path = Path(__file__).resolve().parent
BACKEND_DIR: Path = APP_DIR.parent


class Settings(BaseSettings):
    """Runtime settings, populated from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="CIRCULO_",
        extra="ignore",          # unknown CIRCULO_* vars must not crash boot
        case_sensitive=False,
    )

    # ── Identity ───────────────────────────────────────────────────────────
    app_name: str = "CIRCULO"
    app_tagline: str = "Agentic Industrial Symbiosis Engine"
    version: str = "0.1.0"
    environment: str = "development"

    # ── HTTP ───────────────────────────────────────────────────────────────
    api_prefix: str = "/api"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # ── Persistence ────────────────────────────────────────────────────────
    database_path: Path = APP_DIR / "database" / "circulo.db"
    memory_path: Path = APP_DIR / "memory" / "memory_store.json"

    # ── LLM (optional enrichment layer — never on the critical path) ───────
    llm_enabled: bool = False
    llm_api_key: str | None = None
    llm_model: str = "claude-sonnet-4-5"
    llm_timeout_seconds: float = 8.0

    # ── Demo hardening ─────────────────────────────────────────────────────
    deterministic_mode: bool = True
    """Master kill-switch. When True, agents take their deterministic path
    even if llm_enabled is True. Flip this if the venue network fails."""

    @property
    def resolved_database_path(self) -> Path:
        """Always return an absolute path, whatever the CWD uvicorn ran from."""
        if self.database_path.is_absolute():
            return self.database_path
        return (BACKEND_DIR / self.database_path).resolve()

    @property
    def llm_available(self) -> bool:
        """The only place the codebase is allowed to ask 'can I use an LLM?'."""
        return (
            self.llm_enabled
            and not self.deterministic_mode
            and bool(self.llm_api_key)
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached accessor — import this, never instantiate Settings() directly."""
    return Settings()