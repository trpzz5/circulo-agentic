"""Deterministic field extraction from manifest text.

This IS the "simulated OCR extraction layer" from your spec: rule-based,
zero external calls, and — critically — the same code path whether the text
came from a real PDF or was pasted directly. Real OCR/NLP can replace only
this module later without touching the DNA agent's interface.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

REQUIRED_FIELDS = (
    "material", "quantity_tonnes_per_month", "moisture_percent",
    "purity_percent", "location", "source_factory",
)

# Each pattern is tried in order; first match wins. Written to tolerate the
# phrasing variance a real manifest generator would produce.
_PATTERNS: dict[str, list[re.Pattern]] = {
    "material": [
        re.compile(r"material\s*[:\-]\s*([A-Za-z0-9 ,/\-]+?)(?:\n|$)", re.IGNORECASE),
        re.compile(r"waste\s*type\s*[:\-]\s*([A-Za-z0-9 ,/\-]+?)(?:\n|$)", re.IGNORECASE),
    ],
    "quantity_tonnes_per_month": [
        re.compile(r"quantity\s*[:\-]\s*([\d.]+)\s*(?:tonnes|t)\s*/?\s*(?:per\s*)?month", re.IGNORECASE),
        re.compile(r"([\d.]+)\s*(?:tonnes|t)\s*/?\s*(?:per\s*)?month", re.IGNORECASE),
    ],
    "moisture_percent": [
        re.compile(r"moisture\s*[:\-]\s*([\d.]+)\s*%", re.IGNORECASE),
    ],
    "purity_percent": [
        re.compile(r"purity\s*[:\-]\s*([\d.]+)\s*%", re.IGNORECASE),
    ],
    "embedded_carbon_kg_co2e": [
        re.compile(r"embedded\s*carbon\s*[:\-]\s*([\d.]+)\s*kg", re.IGNORECASE),
        re.compile(r"co2e?\s*[:\-]\s*([\d.]+)\s*kg", re.IGNORECASE),
    ],
    "location": [
        re.compile(r"location\s*[:\-]\s*([A-Za-z ,\-]+?)(?:\n|$)", re.IGNORECASE),
    ],
    "source_factory": [
        re.compile(r"source\s*factory\s*[:\-]\s*([A-Za-z0-9 &.,\-]+?)(?:\n|$)", re.IGNORECASE),
        re.compile(r"^\s*(?:facility|factory)\s*[:\-]\s*([A-Za-z0-9 &.,\-]+?)(?:\n|$)", re.IGNORECASE | re.MULTILINE),
    ],
}

_NUMERIC_FIELDS = {"quantity_tonnes_per_month", "moisture_percent", "purity_percent", "embedded_carbon_kg_co2e"}


@dataclass
class ExtractionResult:
    fields: dict[str, str | float] = field(default_factory=dict)
    matched_field_names: list[str] = field(default_factory=list)
    missing_required: list[str] = field(default_factory=list)

    @property
    def confidence(self) -> float:
        """Fraction of REQUIRED fields successfully matched."""
        if not REQUIRED_FIELDS:
            return 0.0
        found = sum(1 for f in REQUIRED_FIELDS if f in self.matched_field_names)
        return round(found / len(REQUIRED_FIELDS), 2)

    @property
    def is_usable(self) -> bool:
        """All required fields present — safe to build a WasteDNA from."""
        return not self.missing_required


def extract_waste_dna_fields(text: str) -> ExtractionResult:
    """Runs every pattern against the text and reports what was found."""
    result = ExtractionResult()

    for field_name, patterns in _PATTERNS.items():
        for pattern in patterns:
            m = pattern.search(text)
            if not m:
                continue
            raw_value = m.group(1).strip().rstrip(",.")
            if field_name in _NUMERIC_FIELDS:
                try:
                    result.fields[field_name] = float(raw_value)
                except ValueError:
                    continue
            else:
                result.fields[field_name] = raw_value
            result.matched_field_names.append(field_name)
            break  # first successful pattern for this field wins

    result.missing_required = [f for f in REQUIRED_FIELDS if f not in result.matched_field_names]
    return result