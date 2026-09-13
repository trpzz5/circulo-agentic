"""Deterministic field extraction from manifest text.

This is the simulated OCR extraction layer from the CIRCULO specification.

It is rule-based, requires no external calls, and uses the same code path
whether the text came from a PDF or was pasted directly.

The extractor supports normal manifest text as well as the structured
markdown/table format used by the CIRCULO frontend.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


REQUIRED_FIELDS = (
    "material",
    "quantity_tonnes_per_month",
    "moisture_percent",
    "purity_percent",
    "location",
    "source_factory",
)


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# These patterns intentionally support several common formats:
#
#   Material: Foundry Sand
#   Material - Foundry Sand
#   Material = Foundry Sand
#   **Material** | Foundry Sand
#   **Material** : Foundry Sand
#
# The frontend currently produces the normal labelled form, while older
# versions of the UI also used markdown/table formatting.
# ---------------------------------------------------------------------------

_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "material": [
        re.compile(
            r"(?im)^\s*\*{0,2}material\*{0,2}\s*(?:\||:|-|=)\s*(.+?)\s*$"
        ),
        re.compile(
            r"(?im)^\s*\*{0,2}waste\s+type\*{0,2}\s*(?:\||:|-|=)\s*(.+?)\s*$"
        ),
    ],
    "quantity_tonnes_per_month": [
        re.compile(
            r"(?im)^\s*\*{0,2}quantity\*{0,2}\s*(?:\||:|-|=)\s*"
            r"([\d.]+)\s*(?:tonnes?|t)\s*/?\s*(?:per\s*)?month\s*$"
        ),
        re.compile(
            r"(?im)^\s*\*{0,2}quantity\*{0,2}\s*(?:\||:|-|=)\s*"
            r"([\d.]+)\s*$"
        ),
        re.compile(
            r"(?i)([\d.]+)\s*(?:tonnes?|t)\s*/?\s*(?:per\s*)?month"
        ),
    ],
    "moisture_percent": [
        re.compile(
            r"(?im)^\s*\*{0,2}moisture\*{0,2}\s*"
            r"(?:\||:|-|=)\s*([\d.]+)\s*%?\s*$"
        ),
    ],
    "purity_percent": [
        re.compile(
            r"(?im)^\s*\*{0,2}purity\*{0,2}\s*"
            r"(?:\||:|-|=)\s*([\d.]+)\s*%?\s*$"
        ),
    ],
    "embedded_carbon_kg_co2e": [
        re.compile(
            r"(?im)^\s*\*{0,2}embedded\s+carbon\*{0,2}\s*"
            r"(?:\||:|-|=)\s*([\d.]+)\s*(?:kg)?"
        ),
        re.compile(
            r"(?im)^\s*\*{0,2}co2e?\*{0,2}\s*"
            r"(?:\||:|-|=)\s*([\d.]+)\s*(?:kg)?"
        ),
    ],
    "location": [
        re.compile(
            r"(?im)^\s*\*{0,2}location\*{0,2}\s*"
            r"(?:\||:|-|=)\s*(.+?)\s*$"
        ),
    ],
    "source_factory": [
        re.compile(
            r"(?im)^\s*\*{0,2}source\s+factory\*{0,2}\s*"
            r"(?:\||:|-|=)\s*(.+?)\s*$"
        ),
        re.compile(
            r"(?im)^\s*\*{0,2}source\*{0,2}\s*"
            r"(?:\||:|-|=)\s*(.+?)\s*$"
        ),
        re.compile(
            r"(?im)^\s*\*{0,2}(?:facility|factory)\*{0,2}\s*"
            r"(?:\||:|-|=)\s*(.+?)\s*$"
        ),
    ],
}


_NUMERIC_FIELDS = {
    "quantity_tonnes_per_month",
    "moisture_percent",
    "purity_percent",
    "embedded_carbon_kg_co2e",
}


# ---------------------------------------------------------------------------
# Extraction result
# ---------------------------------------------------------------------------

@dataclass
class ExtractionResult:
    fields: dict[str, str | float] = field(default_factory=dict)
    matched_field_names: list[str] = field(default_factory=list)
    missing_required: list[str] = field(default_factory=list)

    @property
    def confidence(self) -> float:
        """Fraction of required fields successfully matched."""
        if not REQUIRED_FIELDS:
            return 0.0

        found = sum(
            1
            for field_name in REQUIRED_FIELDS
            if field_name in self.matched_field_names
        )

        return round(found / len(REQUIRED_FIELDS), 2)

    @property
    def is_usable(self) -> bool:
        """All required fields are present."""
        return not self.missing_required


# ---------------------------------------------------------------------------
# Value cleanup
# ---------------------------------------------------------------------------

def _clean_value(value: str) -> str:
    """Remove markdown/table formatting around extracted values."""
    value = value.strip()

    # Remove markdown emphasis.
    value = value.replace("**", "")

    # Remove accidental table separators.
    value = value.strip("|").strip()

    # Remove trailing punctuation without disturbing names containing dots.
    return value.rstrip(",").strip()


# ---------------------------------------------------------------------------
# Main extractor
# ---------------------------------------------------------------------------

def extract_waste_dna_fields(text: str) -> ExtractionResult:
    """Run every extraction pattern against the supplied manifest text.

    Supports both ordinary manifest text and the structured markdown/table
    format used by the CIRCULO frontend.
    """
    result = ExtractionResult()

    if not text or not text.strip():
        result.missing_required = list(REQUIRED_FIELDS)
        return result

    for field_name, patterns in _PATTERNS.items():
        for pattern in patterns:
            match = pattern.search(text)

            if not match:
                continue

            raw_value = _clean_value(match.group(1))

            if not raw_value:
                continue

            if field_name in _NUMERIC_FIELDS:
                try:
                    numeric_value = float(raw_value)
                except ValueError:
                    continue

                result.fields[field_name] = numeric_value
            else:
                result.fields[field_name] = raw_value

            if field_name not in result.matched_field_names:
                result.matched_field_names.append(field_name)

            # First successful pattern wins.
            break

    result.missing_required = [
        field_name
        for field_name in REQUIRED_FIELDS
        if field_name not in result.matched_field_names
    ]

    return result