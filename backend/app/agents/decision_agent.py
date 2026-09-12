"""Agent 4 — Decision Agent (memory + planning + final decision).

Checks persistent memory before recommending a route, explains every
rejection with a concrete reason, breaks close economic calls using verified
track record rather than always chasing the highest number, and writes new
outcomes back to memory so future runs have more precedent than this one.

Never exposes hidden chain-of-thought — `debate` is a short list of
concise, user-facing, verifiable reasoning lines.
"""

from __future__ import annotations

import logging

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DecisionPayload, DecisionRequest
from app.api.schemas.common import AgentName, ExecutionSource
from app.database import get_connection
from app.memory.memory_store import find_prior_outcomes, record_outcome
from app.tools.materials import resolve_material_id

logger = logging.getLogger(__name__)

# A candidate within this fraction of the top ecosystem value is treated as
# an economic tie — close enough that a verified track record should decide
# it. Anything wider than this and raw economics wins regardless of memory.
CLOSE_CALL_THRESHOLD = 0.05


class DecisionAgent(BaseAgent[DecisionRequest, DecisionPayload]):
    name = AgentName.DECISION
    activity_label = "DECIDING"
    description = (
        "Checks persistent memory for prior rejections and constraints, then "
        "selects and justifies the viable circular route."
    )

    async def execute(self, payload: DecisionRequest, run_id: str) -> AgentResult[DecisionPayload]:
        dna = payload.waste_dna

        with get_connection() as conn:
            original_material_id, _ = resolve_material_id(conn, dna.material)

        debate: list[str] = []
        memory_hits: list[dict] = []
        rejected_routes: list[dict] = []

        # ── 1) Explain every rejected direct candidate, grounded in memory ──
        for route in payload.routes:
            if "hops" in route or route.get("status") == "viable":
                continue  # viable candidates are handled via the impact data below

            factory_id = route["factory_id"]
            material_id = route.get("material_id") or original_material_id or dna.material
            prior = find_prior_outcomes(factory_id, material_id) if material_id else []
            memory_hits.extend(prior)

            reason_text = "; ".join(route.get("reasons", [])) or "not accepted"
            prior_rejections = [p for p in prior if p.get("outcome") == "rejected"]

            if prior_rejections:
                most_recent = prior_rejections[-1]
                debate.append(
                    f"Direct route to {route['factory_name']} rejected: {reason_text}. "
                    f"Matches {len(prior_rejections)} prior recorded rejection(s) — "
                    f"most recent on {most_recent['date'][:10]}."
                )
            else:
                debate.append(f"Direct route to {route['factory_name']} rejected: {reason_text}.")
                record_outcome(
                    factory_id=factory_id,
                    factory_name=route["factory_name"],
                    material_id=material_id,
                    material_name=route.get("material_name", dna.material),
                    source_factory=dna.source_factory,
                    outcome="rejected",
                    reason=(route.get("reasons") or [route.get("status", "rejected")])[0],
                    limit_percent=route.get("moisture_limit_percent"),
                    observed_percent=dna.moisture_percent,
                    notes="Recorded automatically by the Decision Agent.",
                )

            rejected_routes.append({
                "factory_id": factory_id,
                "factory_name": route["factory_name"],
                "status": route["status"],
                "reasons": route.get("reasons", []),
                "prior_outcomes": prior,
            })

        # ── 2) Score every viable, costed candidate from the Impact Agent ───
        raw_by_key = {(r.get("route_key") or r.get("factory_id")): r for r in payload.routes}
        per_route = payload.impact.get("per_route", [])

        scored: list[dict] = []
        for entry in per_route:
            dest_id = entry["destination_factory_id"]
            key = entry.get("route_key") or dest_id
            raw = raw_by_key.get(key, {})
            material_id_for_memory = raw.get("final_material_id") or raw.get("material_id") or original_material_id

            prior = find_prior_outcomes(dest_id, material_id_for_memory) if material_id_for_memory else []
            memory_hits.extend(prior)
            has_track_record = any(p.get("outcome") == "accepted" for p in prior)

            scored.append({
                "route_key": key,
                "destination_factory_id": dest_id,
                "destination_factory_name": entry["destination_factory_name"],
                "label": entry["label"],
                "hop_count": entry["hop_count"],
                "ecosystem_value": entry["ecosystem_value"]["value"],
                "co2_saved": entry["co2_saved"]["value"],
                "material_id_for_memory": material_id_for_memory,
                "prior_outcomes": prior,
                "has_track_record": has_track_record,
            })

        if not scored:
            debate.append("No viable, costed route was available to recommend.")
            return AgentResult(
                data=DecisionPayload(
                    recommended_route_id=None, rejected_routes=rejected_routes,
                    debate=debate, memory_hits=memory_hits, confidence=0.0,
                ),
                source=ExecutionSource.DETERMINISTIC,
                notes=["No candidates to decide between."],
            )

        # ── 3) Rank by ecosystem value, then let a verified track record ────
        #      break any tie within CLOSE_CALL_THRESHOLD of the top value.
        scored_sorted = sorted(scored, key=lambda s: s["ecosystem_value"], reverse=True)
        top = scored_sorted[0]
        top_value = top["ecosystem_value"]

        def within_threshold(candidate: dict) -> bool:
            if top_value <= 0:
                return candidate["ecosystem_value"] == top_value
            return (top_value - candidate["ecosystem_value"]) / top_value <= CLOSE_CALL_THRESHOLD

        close_candidates = [c for c in scored_sorted if within_threshold(c)]
        grounded_close_candidates = [c for c in close_candidates if c["has_track_record"]]

        for c in scored_sorted:
            debate.append(
                f"Candidate: {c['label']} — ecosystem value Rs.{c['ecosystem_value']:,.2f}, "
                f"CO2 reduction {c['co2_saved']:,.2f} kg CO2e"
                + (", verified prior transaction on record." if c["has_track_record"] else ", no prior transaction on record.")
            )

        if grounded_close_candidates and not top["has_track_record"]:
            chosen = max(grounded_close_candidates, key=lambda c: c["ecosystem_value"])
            margin_pct = round((top_value - chosen["ecosystem_value"]) / top_value * 100, 1) if top_value else 0.0
            debate.append(
                f"{top['label']} has the highest raw ecosystem value, but {chosen['label']} is within "
                f"{margin_pct}% of it and has a verified successful prior transaction — "
                f"recommending {chosen['label']} over a marginal, unproven economic edge."
            )
            confidence = 0.85
        else:
            chosen = top
            if chosen["has_track_record"]:
                debate.append(f"Recommending {chosen['label']} — highest ecosystem value AND a verified prior transaction.")
                confidence = 0.9
            else:
                debate.append(f"Recommending {chosen['label']} — highest ecosystem value; no historical precedent exists yet for any candidate.")
                confidence = 0.65

        if len(rejected_routes) > 0 and any(r["prior_outcomes"] for r in rejected_routes):
            confidence = min(confidence + 0.05, 0.95)

        # ── 4) Log this decision as a new memory record ─────────────────────
        record = record_outcome(
            factory_id=chosen["destination_factory_id"],
            factory_name=chosen["destination_factory_name"],
            material_id=chosen["material_id_for_memory"] or "unknown",
            material_name=chosen["material_id_for_memory"] or dna.material,
            source_factory=dna.source_factory,
            outcome="accepted",
            reason="selected_by_decision_agent",
            notes=f"Ecosystem value Rs.{chosen['ecosystem_value']:,.2f}; route={chosen['label']}.",
        )
        memory_hits.append(record)

        notes = [
            f"Evaluated {len(scored)} viable candidate(s) and {len(rejected_routes)} rejected candidate(s).",
            f"Recommended: {chosen['label']} (confidence {confidence:.0%}).",
        ]

        return AgentResult(
            data=DecisionPayload(
                recommended_route_id=chosen["route_key"],
                rejected_routes=rejected_routes,
                debate=debate,
                memory_hits=memory_hits,
                confidence=confidence,
            ),
            source=ExecutionSource.DETERMINISTIC,
            notes=notes,
        )