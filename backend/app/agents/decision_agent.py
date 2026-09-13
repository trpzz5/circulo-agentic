"""Agent 4 — Decision Agent (memory + planning + final decision).

Checks persistent memory before recommending a route, explains every
rejection with a concrete reason, breaks close economic calls using verified
track record rather than always chasing the highest number, and writes new
outcomes back to memory so future runs have more precedent than this one —
UNLESS this is a what-if simulation (`payload.persist_to_memory is False`),
in which case memory is still read for context but never written.

Important correctness rule:
Only routes explicitly marked as "viable" by the Discovery Agent may be
scored and recommended.

Rejected routes may still appear in Impact results for transparency, but
they must NEVER become recommendation candidates.
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
# an economic tie — close enough that a verified track record should decide.
CLOSE_CALL_THRESHOLD = 0.05


class DecisionAgent(BaseAgent[DecisionRequest, DecisionPayload]):
    name = AgentName.DECISION
    activity_label = "DECIDING"

    description = (
        "Checks persistent memory for prior rejections and constraints, "
        "then selects and justifies the viable circular route."
    )

    async def execute(
        self,
        payload: DecisionRequest,
        run_id: str,
    ) -> AgentResult[DecisionPayload]:

        dna = payload.waste_dna
        persist = payload.persist_to_memory

        # ---------------------------------------------------------------
        # Resolve the original material ID once for memory lookups.
        # ---------------------------------------------------------------
        with get_connection() as conn:
            original_material_id, _ = resolve_material_id(conn, dna.material)

        debate: list[str] = []
        memory_hits: list[dict] = []
        rejected_routes: list[dict] = []

        # Build a lookup of Discovery routes.
        #
        # Impact may contain calculations for routes that Discovery rejected.
        # Therefore Discovery's status is the source of truth for viability.
        raw_by_key = {
            (route.get("route_key") or route.get("factory_id")): route
            for route in payload.routes
        }

        # ---------------------------------------------------------------
        # 1) Explain every rejected route.
        #
        # Anything that is NOT explicitly viable is treated as rejected.
        # This fixes the old logic which could accidentally skip rejected
        # multi-hop routes merely because they contained "hops".
        # ---------------------------------------------------------------
        for route in payload.routes:

            route_status = route.get("status")

            if route_status == "viable":
                continue

            factory_id = route.get("factory_id")
            factory_name = route.get("factory_name", "Unknown destination")

            if not factory_id:
                logger.warning(
                    "[%s] Rejected route has no factory_id: %s",
                    run_id,
                    route,
                )
                continue

            material_id = (
                route.get("material_id")
                or original_material_id
                or dna.material
            )

            prior = (
                find_prior_outcomes(factory_id, material_id)
                if material_id
                else []
            )

            memory_hits.extend(prior)

            reasons = route.get("reasons", [])
            reason_text = "; ".join(reasons) or "not accepted"

            prior_rejections = [
                p for p in prior
                if p.get("outcome") == "rejected"
            ]

            if prior_rejections:
                most_recent = prior_rejections[-1]

                debate.append(
                    f"Route to {factory_name} rejected: {reason_text}. "
                    f"Matches {len(prior_rejections)} prior recorded "
                    f"rejection(s) — most recent on "
                    f"{most_recent.get('date', '')[:10]}."
                )

            else:
                debate.append(
                    f"Route to {factory_name} rejected: {reason_text}."
                )

                # Only real analyses write rejection history.
                if persist:
                    record_outcome(
                        factory_id=factory_id,
                        factory_name=factory_name,
                        material_id=material_id,
                        material_name=route.get(
                            "material_name",
                            dna.material,
                        ),
                        source_factory=dna.source_factory,
                        outcome="rejected",
                        reason=(
                            reasons[0]
                            if reasons
                            else route_status or "rejected"
                        ),
                        limit_percent=route.get(
                            "moisture_limit_percent"
                        ),
                        observed_percent=dna.moisture_percent,
                        notes=(
                            "Recorded automatically by the "
                            "Decision Agent."
                        ),
                    )

            rejected_routes.append(
                {
                    "factory_id": factory_id,
                    "factory_name": factory_name,
                    "status": route_status or "rejected",
                    "reasons": reasons,
                    "prior_outcomes": prior,
                }
            )

        # ---------------------------------------------------------------
        # 2) Score ONLY viable routes.
        #
        # IMPORTANT:
        # Impact may calculate values for rejected routes.
        # We explicitly cross-check the corresponding Discovery route
        # before adding anything to `scored`.
        # ---------------------------------------------------------------
        per_route = payload.impact.get("per_route", [])

        scored: list[dict] = []

        for entry in per_route:

            dest_id = entry.get("destination_factory_id")

            if not dest_id:
                continue

            key = entry.get("route_key") or dest_id

            # Find the original Discovery route.
            raw = raw_by_key.get(key)

            # Some implementations may use destination_factory_id as
            # the route key, so try that as a fallback.
            if raw is None:
                raw = raw_by_key.get(dest_id)

            # -----------------------------------------------------------
            # THE CRITICAL FIX
            #
            # Never score an Impact result unless Discovery explicitly
            # marked the corresponding route as viable.
            # -----------------------------------------------------------
            if raw is None:
                logger.warning(
                    "[%s] Impact route %s has no matching Discovery "
                    "route; skipping it.",
                    run_id,
                    key,
                )
                continue

            if raw.get("status") != "viable":
                logger.info(
                    "[%s] Skipping rejected route from Decision scoring: %s",
                    run_id,
                    raw.get("factory_name", dest_id),
                )
                continue

            # -----------------------------------------------------------
            # Memory lookup for viable destination.
            # -----------------------------------------------------------
            material_id_for_memory = (
                raw.get("final_material_id")
                or raw.get("material_id")
                or original_material_id
            )

            prior = (
                find_prior_outcomes(
                    dest_id,
                    material_id_for_memory,
                )
                if material_id_for_memory
                else []
            )

            memory_hits.extend(prior)

            has_track_record = any(
                p.get("outcome") == "accepted"
                for p in prior
            )

            # -----------------------------------------------------------
            # Safely extract Impact values.
            # -----------------------------------------------------------
            ecosystem_value_data = entry.get("ecosystem_value", {})
            co2_saved_data = entry.get("co2_saved", {})

            ecosystem_value = ecosystem_value_data.get("value", 0.0)
            co2_saved = co2_saved_data.get("value", 0.0)

            scored.append(
                {
                    "route_key": key,
                    "destination_factory_id": dest_id,
                    "destination_factory_name": entry.get(
                        "destination_factory_name",
                        raw.get("factory_name", dest_id),
                    ),
                    "label": entry.get(
                        "label",
                        raw.get(
                            "factory_name",
                            dest_id,
                        ),
                    ),
                    "hop_count": entry.get(
                        "hop_count",
                        raw.get("hops", 1),
                    ),
                    "ecosystem_value": ecosystem_value,
                    "co2_saved": co2_saved,
                    "material_id_for_memory": material_id_for_memory,
                    "prior_outcomes": prior,
                    "has_track_record": has_track_record,
                }
            )

        # ---------------------------------------------------------------
        # 3) No viable routes = NO RECOMMENDATION.
        #
        # This is the critical Test 3 behavior.
        # ---------------------------------------------------------------
        if not scored:

            debate.append(
                "No viable, costed route was available to recommend."
            )

            return AgentResult(
                data=DecisionPayload(
                    recommended_route_id=None,
                    rejected_routes=rejected_routes,
                    debate=debate,
                    memory_hits=memory_hits,
                    confidence=0.0,
                ),
                source=ExecutionSource.DETERMINISTIC,
                notes=[
                    "No viable candidates to decide between."
                ],
            )

        # ---------------------------------------------------------------
        # 4) Rank viable candidates by ecosystem value.
        # ---------------------------------------------------------------
        scored_sorted = sorted(
            scored,
            key=lambda s: s["ecosystem_value"],
            reverse=True,
        )

        top = scored_sorted[0]
        top_value = top["ecosystem_value"]

        def within_threshold(candidate: dict) -> bool:
            if top_value <= 0:
                return candidate["ecosystem_value"] == top_value

            return (
                (top_value - candidate["ecosystem_value"])
                / top_value
                <= CLOSE_CALL_THRESHOLD
            )

        close_candidates = [
            candidate
            for candidate in scored_sorted
            if within_threshold(candidate)
        ]

        grounded_close_candidates = [
            candidate
            for candidate in close_candidates
            if candidate["has_track_record"]
        ]

        # ---------------------------------------------------------------
        # 5) Explain every viable candidate.
        # ---------------------------------------------------------------
        for candidate in scored_sorted:

            debate.append(
                f"Candidate: {candidate['label']} — "
                f"ecosystem value "
                f"Rs.{candidate['ecosystem_value']:,.2f}, "
                f"CO2 reduction "
                f"{candidate['co2_saved']:,.2f} kg CO2e"
                + (
                    ", verified prior transaction on record."
                    if candidate["has_track_record"]
                    else ", no prior transaction on record."
                )
            )

        # ---------------------------------------------------------------
        # 6) Choose the best viable candidate.
        #
        # A verified prior transaction can break an economic tie within
        # CLOSE_CALL_THRESHOLD.
        # ---------------------------------------------------------------
        if grounded_close_candidates and not top["has_track_record"]:

            chosen = max(
                grounded_close_candidates,
                key=lambda c: c["ecosystem_value"],
            )

            margin_pct = (
                round(
                    (
                        (top_value - chosen["ecosystem_value"])
                        / top_value
                    )
                    * 100,
                    1,
                )
                if top_value
                else 0.0
            )

            debate.append(
                f"{top['label']} has the highest raw ecosystem value, "
                f"but {chosen['label']} is within {margin_pct}% of it "
                f"and has a verified successful prior transaction — "
                f"recommending {chosen['label']} over a marginal, "
                f"unproven economic edge."
            )

            confidence = 0.85

        else:

            chosen = top

            if chosen["has_track_record"]:

                debate.append(
                    f"Recommending {chosen['label']} — "
                    f"highest ecosystem value AND a verified "
                    f"prior transaction."
                )

                confidence = 0.90

            else:

                debate.append(
                    f"Recommending {chosen['label']} — "
                    f"highest ecosystem value; no historical "
                    f"precedent exists yet for any candidate."
                )

                confidence = 0.65

        # ---------------------------------------------------------------
        # 7) Increase confidence when rejected routes have historical
        #    precedent.
        # ---------------------------------------------------------------
        if (
            len(rejected_routes) > 0
            and any(
                route["prior_outcomes"]
                for route in rejected_routes
            )
        ):
            confidence = min(
                confidence + 0.05,
                0.95,
            )

        # ---------------------------------------------------------------
        # 8) Record accepted decision for real runs only.
        # ---------------------------------------------------------------
        if persist:

            record = record_outcome(
                factory_id=chosen["destination_factory_id"],
                factory_name=chosen["destination_factory_name"],
                material_id=(
                    chosen["material_id_for_memory"]
                    or "unknown"
                ),
                material_name=dna.material,
                source_factory=dna.source_factory,
                outcome="accepted",
                reason="selected_by_decision_agent",
                notes=(
                    f"Ecosystem value "
                    f"Rs.{chosen['ecosystem_value']:,.2f}; "
                    f"route={chosen['label']}."
                ),
            )

            memory_hits.append(record)

        else:

            debate.append(
                "What-if mode — this outcome was not written "
                "to persistent memory."
            )

        # ---------------------------------------------------------------
        # 9) Final notes.
        # ---------------------------------------------------------------
        notes = [
            f"Evaluated {len(scored)} viable candidate(s) and "
            f"{len(rejected_routes)} rejected candidate(s).",
            (
                f"Recommended: {chosen['label']} "
                f"(confidence {confidence:.0%})."
            ),
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