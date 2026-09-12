"""Agent 1 — Data & DNA Agent (perception / ingestion).

Extraction is deterministic and rule-based (app/services/manifest_extractor.py).
Every failure mode — no input, missing fields, invalid values — collapses
into the Golden Path fixture rather than an exception or free-text output,
per the hard requirement: this agent must never return unstructured prose
where structured data is required.
"""

from __future__ import annotations

import logging

from pydantic import ValidationError

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DNARequest
from app.api.schemas.common import AgentName, ExecutionSource
from app.api.schemas.waste import WasteDNA
from app.services.manifest_extractor import extract_waste_dna_fields
from app.services.manifest_store import get_manifest

logger = logging.getLogger(__name__)

# The offline-safe fixture. Used whenever real extraction isn't possible or
# doesn't fully succeed — this is what keeps the demo alive with no network
# and no valid input.
GOLDEN_PATH_DNA = WasteDNA(
    material="Foundry Sand",
    quantity_tonnes_per_month=20.0,
    moisture_percent=12.0,
    purity_percent=94.0,
    embedded_carbon_kg_co2e=1200.0,
    location="Mangalore",
    source_factory="ABC Foundry",
    extraction_confidence=1.0,
)


class DNAAgent(BaseAgent[DNARequest, WasteDNA]):
    name = AgentName.DNA
    activity_label = "EXTRACTING"
    description = "Parses waste manifests into a strict Waste DNA structure."

    async def execute(self, payload: DNARequest, run_id: str) -> AgentResult[WasteDNA]:
        raw_text, source_label = self._resolve_text(payload)

        if raw_text is None:
            return AgentResult(
                data=GOLDEN_PATH_DNA,
                source=ExecutionSource.FALLBACK,
                notes=["No manifest text or manifest_id supplied — using Golden Path fixture."],
            )

        extraction = extract_waste_dna_fields(raw_text)

        if not extraction.is_usable:
            logger.warning(
                "[%s] extraction incomplete from %s — missing %s",
                run_id, source_label, extraction.missing_required,
            )
            return AgentResult(
                data=GOLDEN_PATH_DNA,
                source=ExecutionSource.FALLBACK,
                notes=[
                    f"Extraction from {source_label} incomplete — "
                    f"missing required field(s): {', '.join(extraction.missing_required)}.",
                    f"Fields recognized: {', '.join(extraction.matched_field_names) or 'none'}.",
                    "Falling back to the Golden Path fixture to keep the pipeline demonstrable.",
                ],
            )

        try:
            waste_dna = WasteDNA(
                material=str(extraction.fields["material"]),
                quantity_tonnes_per_month=float(extraction.fields["quantity_tonnes_per_month"]),
                moisture_percent=float(extraction.fields["moisture_percent"]),
                purity_percent=float(extraction.fields["purity_percent"]),
                embedded_carbon_kg_co2e=float(extraction.fields.get("embedded_carbon_kg_co2e", 0.0)),
                location=str(extraction.fields["location"]),
                source_factory=str(extraction.fields["source_factory"]),
                manifest_id=payload.manifest_id,
                extraction_confidence=extraction.confidence,
            )
        except ValidationError as exc:
            logger.warning("[%s] extracted fields failed validation: %s", run_id, exc)
            return AgentResult(
                data=GOLDEN_PATH_DNA,
                source=ExecutionSource.FALLBACK,
                notes=[
                    f"Extracted values from {source_label} failed validation ({exc.error_count()} issue(s)).",
                    "Falling back to the Golden Path fixture.",
                ],
            )

        return AgentResult(
            data=waste_dna,
            source=ExecutionSource.DETERMINISTIC,
            notes=[
                f"Extracted from {source_label} — {len(extraction.matched_field_names)}/"
                f"{len(extraction.matched_field_names)} recognized fields "
                f"(confidence {extraction.confidence:.0%}).",
            ],
        )

    @staticmethod
    def _resolve_text(payload: DNARequest) -> tuple[str | None, str]:
        """Priority: explicit raw_text > stored manifest_id > nothing."""
        if payload.raw_text and payload.raw_text.strip():
            return payload.raw_text, "pasted text"

        if payload.manifest_id:
            record = get_manifest(payload.manifest_id)
            if record and record.get("raw_text", "").strip():
                return record["raw_text"], f"manifest '{record['filename']}'"
            return None, "manifest (not found or empty)"

        return None, "no input"