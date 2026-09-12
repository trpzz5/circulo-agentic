# CIRCULO backend — Phase 10 containerization.
#
# Built from the REPO ROOT (not backend/) so this Dockerfile can COPY both
# backend/ and data/ as siblings, matching the exact folder layout
# backend/app/config.py expects (BACKEND_DIR = this file's parent, and
# PROJECT_ROOT = one level above that, used for data/manifests). Mirroring
# the real repo structure inside the image means zero path env-var
# overrides are needed — it just works the same as running it locally.
#
# python:3.11-slim, NOT 3.14 — pydantic-core has no prebuilt wheel for 3.14
# yet and fails to build from source without a Rust toolchain (we hit this
# exact issue running the backend locally in Phase 9).
FROM python:3.11-slim

WORKDIR /app

# Install deps first (separate layer) so `docker compose build` doesn't
# re-download every package every time application code changes.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend backend
COPY data data

WORKDIR /app/backend

EXPOSE 8000

# seed.py is idempotent (skips if factories already exist) — safe to run
# on every container start. This is what guarantees the container never
# boots with an empty database (factories=0), which is a silent, very
# demo-breaking failure mode if skipped.
CMD ["sh", "-c", "python -m app.database.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]