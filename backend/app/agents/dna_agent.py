"""Agent 1 — Data & DNA Agent (perception / ingestion).

Extraction is deterministic and rule-based.

The agent first uses the shared manifest extractor. If that extractor
cannot recognize the pasted manifest completely, a small structured
fallback parser handles the manifest format produced by the CIRCULO UI.

Only genuinely missing/invalid input falls back to the Golden Path fixture.
"""

from __future__ import annotations

import logging
import re

from pydantic import ValidationError

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DNARequest
from app.api.schemas.common import AgentName, ExecutionSource
from app.api.schemas.waste import WasteDNA
from app.services.manifest_extractor import extract_waste_dna_fields
from app.services.manifest_store import get_manifest


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Golden Path fixture
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_value(value: str) -> str:
    """Clean markdown/table formatting around a manifest value."""
    value = value.strip()

    # Remove markdown emphasis.
    value = value.replace("**", "")

    # Remove common table separators.
    value = value.strip("|").strip()

    # Remove common trailing punctuation.
    return value.rstrip(",").strip()


def _extract_labeled_value(text: str, label: str) -> str | None:
    """Extract a value from a line such as:

    **Material** | Foundry Sand
    Material : Foundry Sand
    Material = Foundry Sand
    Material - Foundry Sand
    """
    pattern = (
        rf"(?im)^\s*\*{{0,2}}{re.escape(label)}\*{{0,2}}"
        rf"\s*(?:\||:|-|=)\s*(.*?)\s*$"
    )

    match = re.search(pattern, text)

    if match:
        value = _clean_value(match.group(1))
        return value or None

    return None


def _extract_numeric_value(text: str, label: str) -> float | None:
    """Extract a numeric value from a labeled manifest field."""
    value = _extract_labeled_value(text, label)

    if value is None:
        return None

    match = re.search(r"-?\d+(?:\.\d+)?", value)

    if not match:
        return None

    try:
        return float(match.group(0))
    except ValueError:
        return None


def _extract_percentage(text: str, label: str) -> float | None:
    """Extract a percentage field such as Moisture: 12%."""
    return _extract_numeric_value(text, label)


def _parse_ui_manifest(raw_text: str) -> WasteDNA | None:
    """Parse the structured manifest format used by the CIRCULO UI.

    Accepted examples:

    **Material**       | Foundry Sand
    Material: Foundry Sand

    **Quantity**       | 10
    Quantity: 10 tonnes/month

    **Moisture**       | 12%
    **Purity**         | 94%
    **Location**       | Mangalore

    **Source Factory** | ABC Foundry
    Source: ABC Foundry
    Factory: ABC Foundry

    Max Hops is intentionally not parsed into WasteDNA because max_hops
    is supplied separately to the pipeline.

    Returns None if required fields cannot be extracted.
    """

    material = _extract_labeled_value(raw_text, "Material")
    quantity = _extract_numeric_value(raw_text, "Quantity")
    moisture = _extract_percentage(raw_text, "Moisture")
    purity = _extract_percentage(raw_text, "Purity")
    location = _extract_labeled_value(raw_text, "Location")

    # Accept all common source/factory labels.
    source_factory = (
        _extract_labeled_value(raw_text, "Source Factory")
        or _extract_labeled_value(raw_text, "Source")
        or _extract_labeled_value(raw_text, "Factory")
        or _extract_labeled_value(raw_text, "Facility")
    )

    embedded_carbon = (
        _extract_numeric_value(raw_text, "Embedded Carbon")
        or _extract_numeric_value(raw_text, "CO2e")
        or 0.0
    )

    required_values = (
        material,
        quantity,
        moisture,
        purity,
        location,
        source_factory,
    )

    if any(value is None for value in required_values):
        return None

    try:
        return WasteDNA(
            material=material,
            quantity_tonnes_per_month=quantity,
            moisture_percent=moisture,
            purity_percent=purity,
            embedded_carbon_kg_co2e=embedded_carbon,
            location=location,
            source_factory=source_factory,
            extraction_confidence=1.0,
        )
    except ValidationError as exc:
        logger.warning(
            "UI manifest parser produced invalid WasteDNA: %s",
            exc,
        )
        return None


# ---------------------------------------------------------------------------
# DNA Agent
# ---------------------------------------------------------------------------

class DNAAgent(BaseAgent[DNARequest, WasteDNA]):
    name = AgentName.DNA
    activity_label = "EXTRACTING"
    description = "Parses waste manifests into a strict Waste DNA structure."

    async def execute(
        self,
        payload: DNARequest,
        run_id: str,
    ) -> AgentResult[WasteDNA]:

        raw_text, source_label = self._resolve_text(payload)

        # -------------------------------------------------------------------
        # No input at all
        # -------------------------------------------------------------------

        if raw_text is None:
            return AgentResult(
                data=GOLDEN_PATH_DNA,
                source=ExecutionSource.FALLBACK,
                notes=[
                    "No manifest text or manifest_id supplied — "
                    "using Golden Path fixture."
                ],
            )

        # -------------------------------------------------------------------
        # First attempt: shared deterministic extractor
        # -------------------------------------------------------------------

        extraction = extract_waste_dna_fields(raw_text)

        if extraction.is_usable:
            try:
                waste_dna = WasteDNA(
                    material=str(extraction.fields["material"]),
                    quantity_tonnes_per_month=float(
                        extraction.fields["quantity_tonnes_per_month"]
                    ),
                    moisture_percent=float(
                        extraction.fields["moisture_percent"]
                    ),
                    purity_percent=float(
                        extraction.fields["purity_percent"]
                    ),
                    embedded_carbon_kg_co2e=float(
                        extraction.fields.get(
                            "embedded_carbon_kg_co2e",
                            0.0,
                        )
                    ),
                    location=str(extraction.fields["location"]),
                    source_factory=str(
                        extraction.fields["source_factory"]
                    ),
                    manifest_id=payload.manifest_id,
                    extraction_confidence=extraction.confidence,
                )

                return AgentResult(
                    data=waste_dna,
                    source=ExecutionSource.DETERMINISTIC,
                    notes=[
                        f"Extracted from {source_label} — "
                        f"{len(extraction.matched_field_names)}/"
                        f"{len(extraction.matched_field_names)} "
                        f"recognized fields "
                        f"(confidence {extraction.confidence:.0%})."
                    ],
                )

            except ValidationError as exc:
                logger.warning(
                    "[%s] shared extractor produced invalid values: %s",
                    run_id,
                    exc,
                )

        # -------------------------------------------------------------------
        # Second attempt: parse the UI's structured manifest directly
        #
        # This prevents valid pasted input from being replaced by the
        # Golden Path fixture merely because the shared extractor does not
        # understand the UI's markdown/table formatting.
        # -------------------------------------------------------------------

        ui_waste_dna = _parse_ui_manifest(raw_text)

        if ui_waste_dna is not None:
            ui_waste_dna = ui_waste_dna.model_copy(
                update={
                    "manifest_id": payload.manifest_id,
                }
            )

            logger.info(
                "[%s] parsed structured UI manifest directly.",
                run_id,
            )

            return AgentResult(
                data=ui_waste_dna,
                source=ExecutionSource.DETERMINISTIC,
                notes=[
                    f"Parsed structured manifest from {source_label} "
                    "using the UI manifest parser.",
                    "Shared manifest extractor did not fully recognize "
                    "the format, but all required fields were recovered "
                    "deterministically.",
                ],
            )

        # -------------------------------------------------------------------
        # Existing extractor failure + direct parser failure
        # -------------------------------------------------------------------

        logger.warning(
            "[%s] extraction incomplete from %s — missing %s",
            run_id,
            source_label,
            extraction.missing_required,
        )

        return AgentResult(
            data=GOLDEN_PATH_DNA,
            source=ExecutionSource.FALLBACK,
            notes=[
                f"Extraction from {source_label} incomplete — "
                f"missing required field(s): "
                f"{', '.join(extraction.missing_required) or 'unknown'}.",
                f"Fields recognized: "
                f"{', '.join(extraction.matched_field_names) or 'none'}.",
                "UI manifest parser could not recover all required fields.",
                "Falling back to the Golden Path fixture.",
            ],
        )

    # -----------------------------------------------------------------------
    # Input resolution
    # -----------------------------------------------------------------------

    @staticmethod
    def _resolve_text(
        payload: DNARequest,
    ) -> tuple[str | None, str]:
        """Priority: explicit raw_text > stored manifest_id > nothing."""

        if payload.raw_text and payload.raw_text.strip():
            return payload.raw_text, "pasted text"

        if payload.manifest_id:
            record = get_manifest(payload.manifest_id)

            if record and record.get("raw_text", "").strip():
                return (
                    record["raw_text"],
                    f"manifest '{record['filename']}'",
                )

            return None, "manifest (not found or empty)"

        return None, "no input"