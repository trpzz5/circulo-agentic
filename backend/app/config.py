"""Application configuration."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR: Path = Path(__file__).resolve().parent
BACKEND_DIR: Path = APP_DIR.parent
PROJECT_ROOT: Path = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="CIRCULO_",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "CIRCULO"
    app_tagline: str = "Agentic Industrial Symbiosis Engine"
    version: str = "0.1.0"
    environment: str = "development"

    api_prefix: str = "/api"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    database_path: Path = APP_DIR / "database" / "circulo.db"
    memory_path: Path = APP_DIR / "memory" / "memory_store.json"

    # ── Phase 3: manifest storage ────────────────────────────────────────────
    manifest_upload_dir: Path = PROJECT_ROOT / "data" / "manifests"
    manifest_registry_path: Path = PROJECT_ROOT / "data" / "manifests" / "_registry.json"
    manifest_max_bytes: int = 10 * 1024 * 1024  # 10 MB — plenty for a manifest PDF

    llm_enabled: bool = False
    llm_api_key: str | None = None
    llm_model: str = "claude-sonnet-4-5"
    llm_timeout_seconds: float = 8.0

    deterministic_mode: bool = True

    @property
    def resolved_database_path(self) -> Path:
        if self.database_path.is_absolute():
            return self.database_path
        return (BACKEND_DIR / self.database_path).resolve()

    @property
    def llm_available(self) -> bool:
        return self.llm_enabled and not self.deterministic_mode and bool(self.llm_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()