"""Deterministic calculation tools for the Impact Agent.

INVARIANT: no LLM may ever produce or adjust any number here. Every function
is pure, and every result is a TracedValue so the frontend's
[View Calculation] modal can show exactly how it was derived.

Reference constants (disposal cost, emission factors) are fixed,
industry-benchmark-style figures for this synthetic dataset — never looked
up per-shipment, and always visible in the returned breakdown so the
assumption is inspectable, never hidden.
"""

from __future__ import annotations

from app.api.schemas.common import TracedValue

# ── Reference constants ─────────────────────────────────────────────────────
DEFAULT_TRANSPORT_RATE_PER_KM: float = 30.0                  # INR/km fallback
DEFAULT_DISPOSAL_COST_PER_TONNE: float = 600.0               # INR/tonne landfill fee avoided
LANDFILL_EMISSION_FACTOR_KG_CO2E_PER_TONNE: float = 450.0    # kg CO2e/tonne landfilled
TRANSPORT_EMISSION_FACTOR_KG_CO2E_PER_TONNE_KM: float = 0.12  # kg CO2e per tonne-km, diesel freight
PROCESSING_EMISSION_FACTOR_KG_CO2E_PER_TONNE: float = 30.0    # kg CO2e/tonne processed


def transportation_cost(distance_km: float, rate_per_km: float) -> TracedValue:
    value = round(distance_km * rate_per_km, 2)
    return TracedValue(
        metric="Transportation Cost", value=value, unit="INR",
        formula="distance_km * rate_per_km",
        inputs={"distance_km": distance_km, "rate_per_km": rate_per_km},
        breakdown=[f"{distance_km} km x Rs.{rate_per_km}/km = Rs.{value:,.2f}"],
    )


def processing_cost(quantity_tonnes: float, rate_per_tonne: float) -> TracedValue:
    value = round(quantity_tonnes * rate_per_tonne, 2)
    return TracedValue(
        metric="Processing Cost", value=value, unit="INR",
        formula="quantity_tonnes * processing_rate_per_tonne",
        inputs={"quantity_tonnes": quantity_tonnes, "rate_per_tonne": rate_per_tonne},
        breakdown=[f"{quantity_tonnes} t x Rs.{rate_per_tonne}/t = Rs.{value:,.2f}"],
    )


def material_value(quantity_tonnes: float, price_per_tonne: float) -> TracedValue:
    value = round(quantity_tonnes * price_per_tonne, 2)
    return TracedValue(
        metric="Material Value", value=value, unit="INR",
        formula="quantity_tonnes * purchase_price_per_tonne",
        inputs={"quantity_tonnes": quantity_tonnes, "price_per_tonne": price_per_tonne},
        breakdown=[f"{quantity_tonnes} t x Rs.{price_per_tonne}/t = Rs.{value:,.2f}"],
    )


def avoided_disposal_cost(
    quantity_tonnes: float, rate_per_tonne: float = DEFAULT_DISPOSAL_COST_PER_TONNE
) -> TracedValue:
    value = round(quantity_tonnes * rate_per_tonne, 2)
    return TracedValue(
        metric="Avoided Disposal Cost", value=value, unit="INR",
        formula="quantity_tonnes * reference_disposal_cost_per_tonne",
        inputs={"quantity_tonnes": quantity_tonnes, "reference_rate_per_tonne": rate_per_tonne},
        breakdown=[
            f"Reference landfill/disposal fee: Rs.{rate_per_tonne}/t (fixed benchmark).",
            f"{quantity_tonnes} t x Rs.{rate_per_tonne}/t avoided = Rs.{value:,.2f}",
        ],
    )


def ecosystem_value(
    avoided_disposal: TracedValue, material: TracedValue, transport: TracedValue, processing: TracedValue
) -> TracedValue:
    value = round(avoided_disposal.value + material.value - transport.value - processing.value, 2)
    return TracedValue(
        metric="Total Ecosystem Value", value=value, unit="INR",
        formula="avoided_disposal_cost + material_value - transportation_cost - processing_cost",
        inputs={
            "avoided_disposal_cost": avoided_disposal.value,
            "material_value": material.value,
            "transportation_cost": transport.value,
            "processing_cost": processing.value,
        },
        breakdown=[
            f"Avoided Disposal Cost: +Rs.{avoided_disposal.value:,.2f}",
            f"Material Value: +Rs.{material.value:,.2f}",
            f"Transportation Cost: -Rs.{transport.value:,.2f}",
            f"Processing Cost: -Rs.{processing.value:,.2f}",
            f"Total: Rs.{value:,.2f}",
        ],
    )


def baseline_emissions(
    quantity_tonnes: float, factor: float = LANDFILL_EMISSION_FACTOR_KG_CO2E_PER_TONNE
) -> TracedValue:
    value = round(quantity_tonnes * factor, 2)
    return TracedValue(
        metric="Baseline Emissions (Landfill)", value=value, unit="kg_co2e",
        formula="quantity_tonnes * landfill_emission_factor",
        inputs={"quantity_tonnes": quantity_tonnes, "factor_kg_co2e_per_tonne": factor},
        breakdown=[f"{quantity_tonnes} t x {factor} kg CO2e/t = {value:,.2f} kg CO2e"],
    )


def transport_emissions(
    distance_km: float, quantity_tonnes: float,
    factor: float = TRANSPORT_EMISSION_FACTOR_KG_CO2E_PER_TONNE_KM,
) -> TracedValue:
    value = round(distance_km * quantity_tonnes * factor, 2)
    return TracedValue(
        metric="Transport Emissions", value=value, unit="kg_co2e",
        formula="distance_km * quantity_tonnes * transport_emission_factor",
        inputs={
            "distance_km": distance_km, "quantity_tonnes": quantity_tonnes,
            "factor_kg_co2e_per_tonne_km": factor,
        },
        breakdown=[f"{distance_km} km x {quantity_tonnes} t x {factor} kg CO2e/t-km = {value:,.2f} kg CO2e"],
    )


def processing_emissions(
    quantity_tonnes: float, hop_count: int,
    factor: float = PROCESSING_EMISSION_FACTOR_KG_CO2E_PER_TONNE,
) -> TracedValue:
    value = round(quantity_tonnes * factor * hop_count, 2)
    return TracedValue(
        metric="Processing Emissions", value=value, unit="kg_co2e",
        formula="quantity_tonnes * processing_emission_factor * processing_hop_count",
        inputs={
            "quantity_tonnes": quantity_tonnes, "factor_kg_co2e_per_tonne": factor,
            "processing_hops": hop_count,
        },
        breakdown=[f"{quantity_tonnes} t x {factor} kg CO2e/t x {hop_count} processing hop(s) = {value:,.2f} kg CO2e"],
    )


def co2_saved(baseline: TracedValue, transport_em: TracedValue, processing_em: TracedValue) -> TracedValue:
    circular_total = round(transport_em.value + processing_em.value, 2)
    value = round(baseline.value - circular_total, 2)
    return TracedValue(
        metric="CO2 Reduction", value=value, unit="kg_co2e",
        formula="baseline_emissions - (transport_emissions + processing_emissions)",
        inputs={
            "baseline_emissions": baseline.value,
            "transport_emissions": transport_em.value,
            "processing_emissions": processing_em.value,
        },
        breakdown=[
            f"Baseline (landfill): {baseline.value:,.2f} kg CO2e",
            f"Circular route total: {transport_em.value:,.2f} + {processing_em.value:,.2f} = {circular_total:,.2f} kg CO2e",
            f"CO2 Reduction: {value:,.2f} kg CO2e",
        ],
    )