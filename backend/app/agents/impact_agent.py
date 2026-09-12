"""Agent 3 — Impact Agent (deterministic tool-use).

INVARIANT: this agent must only ever emit ExecutionSource.DETERMINISTIC.
No LLM produces or adjusts a number here — every calculation is a pure
function in app/tools/calculations.py, and every result carries its formula,
inputs, and a step-by-step breakdown for the frontend's [View Calculation]
modal.
"""

from __future__ import annotations

import logging
import sqlite3

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import ImpactPayload, ImpactRequest
from app.api.schemas.common import AgentName, ExecutionSource, TracedValue
from app.database import get_connection
from app.tools.calculations import (
    DEFAULT_TRANSPORT_RATE_PER_KM,
    avoided_disposal_cost,
    baseline_emissions,
    co2_saved,
    ecosystem_value,
    material_value,
    processing_cost,
    processing_emissions,
    transport_emissions,
    transportation_cost,
)

logger = logging.getLogger(__name__)


class ImpactAgent(BaseAgent[ImpactRequest, ImpactPayload]):
    name = AgentName.IMPACT
    activity_label = "CALCULATING"
    description = (
        "Computes transport, processing, CO2 and ecosystem value using pure "
        "Python functions. Every number ships with its formula and inputs."
    )

    async def execute(self, payload: ImpactRequest, run_id: str) -> AgentResult[ImpactPayload]:
        quantity = payload.waste_dna.quantity_tonnes_per_month
        per_route: list[dict] = []
        best: tuple[float, dict] | None = None
        skipped = 0

        with get_connection() as conn:
            for route in payload.routes:
                costed = self._cost_route(conn, route, quantity)
                if costed is None:
                    skipped += 1
                    continue
                per_route.append(costed)
                ev = costed["ecosystem_value"]["value"]
                if best is None or ev > best[0]:
                    best = (ev, costed)

        ecosystem_value_out = best[1]["_ecosystem_value_traced"] if best else None
        co2_saved_out = best[1]["_co2_saved_traced"] if best else None

        for r in per_route:
            r.pop("_ecosystem_value_traced", None)
            r.pop("_co2_saved_traced", None)

        notes = [f"Costed {len(per_route)} viable candidate(s); skipped {skipped} non-viable candidate(s)."]
        if best:
            notes.append(
                f"Highest deterministic ecosystem value: {best[1]['label']} "
                f"(Rs.{best[0]:,.2f}). Final selection is made by the Decision Agent."
            )

        return AgentResult(
            data=ImpactPayload(per_route=per_route, ecosystem_value=ecosystem_value_out, co2_saved=co2_saved_out),
            source=ExecutionSource.DETERMINISTIC,
            notes=notes,
        )

    # ── Costing ──────────────────────────────────────────────────────────

    def _cost_route(self, conn: sqlite3.Connection, route: dict, quantity: float) -> dict | None:
        if "hops" in route:
            return self._cost_multi_hop(conn, route, quantity)
        return self._cost_direct(conn, route, quantity)

    def _rate_for(self, conn: sqlite3.Connection, factory_id: str) -> float:
        row = conn.execute(
            "SELECT transportation_rate_per_km FROM factories WHERE factory_id = ?", (factory_id,)
        ).fetchone()
        return row["transportation_rate_per_km"] if row else DEFAULT_TRANSPORT_RATE_PER_KM

    def _cost_direct(self, conn: sqlite3.Connection, route: dict, quantity: float) -> dict | None:
        if route.get("status") != "viable":
            return None

        distance = route["distance_km"]
        rate = self._rate_for(conn, route["factory_id"])
        transport = transportation_cost(distance, rate)
        processing = processing_cost(quantity, route.get("processing_cost_per_tonne", 0.0))
        material = material_value(quantity, route.get("purchase_price_per_tonne", 0.0))
        avoided = avoided_disposal_cost(quantity)
        eco = ecosystem_value(avoided, material, transport, processing)

        hop_has_processing = (route.get("processing_cost_per_tonne") or 0.0) > 0
        baseline = baseline_emissions(quantity)
        transport_em = transport_emissions(distance, quantity)
        processing_em = processing_emissions(quantity, hop_count=1 if hop_has_processing else 0)
        co2 = co2_saved(baseline, transport_em, processing_em)

        return {
            "route_type": "direct",
            "label": f"Direct sale to {route['factory_name']}",
            "destination_factory_id": route["factory_id"],
            "destination_factory_name": route["factory_name"],
            "hop_count": 0,
            "transportation_cost": transport.model_dump(),
            "processing_cost": processing.model_dump(),
            "material_value": material.model_dump(),
            "avoided_disposal_cost": avoided.model_dump(),
            "ecosystem_value": eco.model_dump(),
            "baseline_emissions": baseline.model_dump(),
            "transport_emissions": transport_em.model_dump(),
            "processing_emissions": processing_em.model_dump(),
            "co2_saved": co2.model_dump(),
            "_ecosystem_value_traced": eco,
            "_co2_saved_traced": co2,
        }

    def _cost_multi_hop(self, conn: sqlite3.Connection, route: dict, quantity: float) -> dict | None:
        if route.get("status") != "viable":
            return None

        hops = route["hops"]
        distance_total = route["total_distance_km"]

        transport_cost_sum = 0.0
        transport_breakdown: list[str] = []
        processing_cost_per_tonne_sum = 0.0
        processing_hop_count = 0

        for hop in hops:
            if hop["role"] == "source":
                continue
            leg_distance = hop.get("distance_from_previous_km") or 0.0
            rate = self._rate_for(conn, hop["factory_id"])
            leg_cost = round(leg_distance * rate, 2)
            transport_cost_sum += leg_cost
            transport_breakdown.append(
                f"{hop['factory_name']}: {leg_distance} km x Rs.{rate}/km = Rs.{leg_cost:,.2f}"
            )
            if hop["role"] == "processor":
                processing_hop_count += 1
                processing_cost_per_tonne_sum += hop.get("processing_cost_per_tonne", 0.0) or 0.0

        transport_tv = TracedValue(
            metric="Transportation Cost", value=round(transport_cost_sum, 2), unit="INR",
            formula="sum(leg_distance_km * leg_rate_per_km)",
            inputs={"total_distance_km": distance_total, "legs": len(hops) - 1},
            breakdown=transport_breakdown,
        )

        processing = processing_cost(quantity, processing_cost_per_tonne_sum)
        destination_hop = hops[-1]
        material = material_value(quantity, destination_hop.get("purchase_price_per_tonne", 0.0))
        avoided = avoided_disposal_cost(quantity)
        eco = ecosystem_value(avoided, material, transport_tv, processing)

        baseline = baseline_emissions(quantity)
        transport_em = transport_emissions(distance_total, quantity)
        processing_em = processing_emissions(quantity, hop_count=processing_hop_count)
        co2 = co2_saved(baseline, transport_em, processing_em)

        processor_names = [h["factory_name"] for h in hops if h["role"] == "processor"]
        label = f"{destination_hop['factory_name']} via {' -> '.join(processor_names)}"

        return {
            "route_type": "multi_hop",
            "label": label,
            "route_key": route.get("route_key"),
            "destination_factory_id": route["destination_factory_id"],
            "destination_factory_name": route["destination_factory_name"],
            "hop_count": route["hop_count"],
            "transportation_cost": transport_tv.model_dump(),
            "processing_cost": processing.model_dump(),
            "material_value": material.model_dump(),
            "avoided_disposal_cost": avoided.model_dump(),
            "ecosystem_value": eco.model_dump(),
            "baseline_emissions": baseline.model_dump(),
            "transport_emissions": transport_em.model_dump(),
            "processing_emissions": processing_em.model_dump(),
            "co2_saved": co2.model_dump(),
            "_ecosystem_value_traced": eco,
            "_co2_saved_traced": co2,
        }