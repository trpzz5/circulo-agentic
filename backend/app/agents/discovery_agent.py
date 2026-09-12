"""Agent 2 — Discovery Agent (reasoning / opportunity discovery).

Finds:
  A. Direct buyers   — factories that accept the material as-is, whether
                        they pass spec or not (a rejection is a reportable
                        result, not a silent omission).
  B. Multi-hop routes — via a bounded BFS over processing_routes: "waste
                        cannot enter X directly, but Y can transform it into
                        something Z accepts."

Pure SQL + Python graph search. No LLM, no randomness — the same Waste DNA
always produces the same discovered candidates.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass, field

from app.agents.base import AgentResult, BaseAgent
from app.api.schemas.agents import DiscoveryPayload, DiscoveryRequest
from app.api.schemas.common import AgentName, ExecutionSource
from app.api.schemas.waste import WasteDNA
from app.database import get_connection
from app.tools.geo import haversine_km, resolve_source_coordinates
from app.tools.materials import resolve_material_id

logger = logging.getLogger(__name__)


@dataclass
class _MaterialState:
    material_id: str
    material_name: str
    moisture_percent: float
    purity_percent: float


@dataclass
class _PathStep:
    factory_id: str
    factory_name: str
    role: str  # "source" | "processor"
    lat: float
    lon: float
    extra: dict = field(default_factory=dict)


class DiscoveryAgent(BaseAgent[DiscoveryRequest, DiscoveryPayload]):
    name = AgentName.DISCOVERY
    activity_label = "SEARCHING"
    description = (
        "Discovers direct buyers and multi-hop transformation pathways "
        "across the industrial network."
    )

    async def execute(
        self, payload: DiscoveryRequest, run_id: str
    ) -> AgentResult[DiscoveryPayload]:
        with get_connection() as conn:
            return self._discover(conn, payload, run_id)

    # ── Core search ──────────────────────────────────────────────────────

    def _discover(
        self, conn: sqlite3.Connection, payload: DiscoveryRequest, run_id: str
    ) -> AgentResult[DiscoveryPayload]:
        dna = payload.waste_dna
        material_id, material_name = resolve_material_id(conn, dna.material)

        if material_id is None:
            return AgentResult(
                data=DiscoveryPayload(candidates_evaluated=0),
                source=ExecutionSource.DETERMINISTIC,
                notes=[f"Material '{dna.material}' is not in the industrial catalog — no candidates."],
            )

        source_lat, source_lon, resolved_via = resolve_source_coordinates(
            conn, dna.source_factory, dna.location
        )
        source_step = _PathStep(
            factory_id="source", factory_name=dna.source_factory, role="source",
            lat=source_lat, lon=source_lon,
        )

        candidates_evaluated = 0
        direct_matches: list[dict] = []
        multi_hop_routes: list[dict] = []

        initial_state = _MaterialState(material_id, material_name, dna.moisture_percent, dna.purity_percent)
        frontier: list[tuple[_MaterialState, list[_PathStep], list[str]]] = [
            (initial_state, [source_step], [])
        ]

        for hop in range(payload.max_hops):
            next_frontier: list[tuple[_MaterialState, list[_PathStep], list[str]]] = []

            for state, path, visited in frontier:
                prev_step = path[-1]

                # 1) Who would buy this material, right now, at this spec?
                buyers, evaluated = self._find_buyers(conn, state, visited)
                candidates_evaluated += evaluated

                for buyer in buyers:
                    distance = haversine_km(prev_step.lat, prev_step.lon, buyer["latitude"], buyer["longitude"])
                    entry = {
                        "factory_id": buyer["factory_id"],
                        "factory_name": buyer["factory_name"],
                        "industry": buyer["industry"],
                        "material_id": state.material_id,
                        "material_name": state.material_name,
                        "status": buyer["status"],
                        "reasons": buyer["reasons"],
                        "distance_km": distance,
                        "within_radius": distance <= payload.max_radius_km,
                        "purchase_price_per_tonne": buyer["purchase_price_per_tonne"],
                        "processing_cost_per_tonne": buyer["processing_cost_per_tonne"],
                        "moisture_limit_percent": buyer["moisture_limit_percent"],
                        "purity_requirement_percent": buyer["purity_requirement_percent"],
                    }

                    if hop == 0:
                        direct_matches.append(entry)
                    elif buyer["status"] == "viable":
                        multi_hop_routes.append(self._build_route(path, buyer, state, distance, dna))

                # 2) Can this material be transformed into something else?
                if hop + 1 < payload.max_hops:
                    transforms, evaluated_t = self._find_transforms(conn, state, visited)
                    candidates_evaluated += evaluated_t

                    for t in transforms:
                        distance = haversine_km(prev_step.lat, prev_step.lon, t["latitude"], t["longitude"])
                        new_state = _MaterialState(
                            t["output_material_id"], t["output_material_name"],
                            t["output_moisture_percent"], t["output_purity_percent"],
                        )
                        new_step = _PathStep(
                            factory_id=t["processor_factory_id"], factory_name=t["processor_factory_name"],
                            role="processor", lat=t["latitude"], lon=t["longitude"],
                            extra={
                                "route_id": t["route_id"],
                                "input_material_id": state.material_id,
                                "input_material_name": state.material_name,
                                "output_material_id": t["output_material_id"],
                                "output_material_name": t["output_material_name"],
                                "output_moisture_percent": t["output_moisture_percent"],
                                "output_purity_percent": t["output_purity_percent"],
                                "processing_cost_per_tonne": t["processing_cost_per_tonne"],
                                "description": t["description"],
                                "distance_from_previous_km": distance,
                            },
                        )
                        next_frontier.append(
                            (new_state, path + [new_step], visited + [t["processor_factory_id"]])
                        )

            frontier = next_frontier
            if not frontier:
                break

        notes = [
            f"Evaluated {candidates_evaluated} factory/material opinion(s) across up to {payload.max_hops} hop(s).",
            f"Source coordinates resolved via: {resolved_via}.",
            f"{len(direct_matches)} direct candidate(s), {len(multi_hop_routes)} multi-hop route(s) found.",
        ]

        return AgentResult(
            data=DiscoveryPayload(
                direct_matches=direct_matches,
                multi_hop_routes=multi_hop_routes,
                candidates_evaluated=candidates_evaluated,
            ),
            source=ExecutionSource.DETERMINISTIC,
            notes=notes,
        )

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _find_buyers(
        conn: sqlite3.Connection, state: _MaterialState, visited: list[str]
    ) -> tuple[list[dict], int]:
        """Every factory with an opinion — accepted or explicitly rejected —
        on this material. Reported whether or not it turns out viable."""
        results: list[dict] = []
        evaluated = 0
        placeholders = ",".join("?" * len(visited)) if visited else None

        accepted_sql = """
            SELECT fam.factory_id, f.factory_name, f.industry, f.latitude, f.longitude,
                   fam.moisture_limit_percent, fam.purity_requirement_percent,
                   fam.purchase_price_per_tonne, fam.processing_cost_per_tonne
            FROM factory_accepted_materials fam
            JOIN factories f ON f.factory_id = fam.factory_id
            WHERE fam.material_id = ?
        """
        params: list = [state.material_id]
        if visited:
            accepted_sql += f" AND fam.factory_id NOT IN ({placeholders})"
            params.extend(visited)

        for row in conn.execute(accepted_sql, params).fetchall():
            evaluated += 1
            reasons: list[str] = []
            moist_ok = row["moisture_limit_percent"] is None or state.moisture_percent <= row["moisture_limit_percent"]
            purity_ok = row["purity_requirement_percent"] is None or state.purity_percent >= row["purity_requirement_percent"]

            if not moist_ok:
                reasons.append(f"moisture {state.moisture_percent}% exceeds limit {row['moisture_limit_percent']}%")
            if not purity_ok:
                reasons.append(f"purity {state.purity_percent}% below requirement {row['purity_requirement_percent']}%")

            results.append({
                "factory_id": row["factory_id"], "factory_name": row["factory_name"],
                "industry": row["industry"], "latitude": row["latitude"], "longitude": row["longitude"],
                "moisture_limit_percent": row["moisture_limit_percent"],
                "purity_requirement_percent": row["purity_requirement_percent"],
                "purchase_price_per_tonne": row["purchase_price_per_tonne"],
                "processing_cost_per_tonne": row["processing_cost_per_tonne"],
                "status": "viable" if (moist_ok and purity_ok) else "rejected_spec",
                "reasons": reasons,
            })

        rejected_sql = """
            SELECT frm.factory_id, f.factory_name, f.industry, f.latitude, f.longitude, frm.reason
            FROM factory_rejected_materials frm
            JOIN factories f ON f.factory_id = frm.factory_id
            WHERE frm.material_id = ?
        """
        rparams: list = [state.material_id]
        if visited:
            rejected_sql += f" AND frm.factory_id NOT IN ({placeholders})"
            rparams.extend(visited)

        for row in conn.execute(rejected_sql, rparams).fetchall():
            evaluated += 1
            results.append({
                "factory_id": row["factory_id"], "factory_name": row["factory_name"],
                "industry": row["industry"], "latitude": row["latitude"], "longitude": row["longitude"],
                "moisture_limit_percent": None, "purity_requirement_percent": None,
                "purchase_price_per_tonne": 0.0, "processing_cost_per_tonne": 0.0,
                "status": "rejected_explicit",
                "reasons": [row["reason"]],
            })

        return results, evaluated

    @staticmethod
    def _find_transforms(
        conn: sqlite3.Connection, state: _MaterialState, visited: list[str]
    ) -> tuple[list[dict], int]:
        """Processors that can accept this material AT ITS CURRENT SPEC and
        transform it into something else."""
        placeholders = ",".join("?" * len(visited)) if visited else None

        sql = """
            SELECT pr.route_id, pr.processor_factory_id, f.factory_name AS processor_factory_name,
                   f.latitude, f.longitude,
                   pr.output_material_id, mo.name AS output_material_name,
                   pr.output_moisture_percent, pr.output_purity_percent,
                   pr.processing_cost_per_tonne, pr.description,
                   fam.moisture_limit_percent AS intake_moisture_limit,
                   fam.purity_requirement_percent AS intake_purity_requirement
            FROM processing_routes pr
            JOIN factories f ON f.factory_id = pr.processor_factory_id
            JOIN materials mo ON mo.material_id = pr.output_material_id
            JOIN factory_accepted_materials fam
                 ON fam.factory_id = pr.processor_factory_id AND fam.material_id = pr.input_material_id
            WHERE pr.input_material_id = ?
        """
        params: list = [state.material_id]
        if visited:
            sql += f" AND pr.processor_factory_id NOT IN ({placeholders})"
            params.extend(visited)

        evaluated = 0
        results: list[dict] = []
        for row in conn.execute(sql, params).fetchall():
            evaluated += 1
            moist_ok = row["intake_moisture_limit"] is None or state.moisture_percent <= row["intake_moisture_limit"]
            purity_ok = row["intake_purity_requirement"] is None or state.purity_percent >= row["intake_purity_requirement"]
            if moist_ok and purity_ok:
                results.append(dict(row))

        return results, evaluated

    @staticmethod
    def _build_route(
        path: list[_PathStep], buyer: dict, state: _MaterialState, last_distance: float, dna: WasteDNA
    ) -> dict:
        hops: list[dict] = []
        total_distance = 0.0

        for i, step in enumerate(path):
            if step.role == "source":
                hops.append({
                    "step": i, "factory_id": "source", "factory_name": step.factory_name, "role": "source",
                    "material_id": None, "material_name": dna.material,
                    "moisture_percent": dna.moisture_percent, "purity_percent": dna.purity_percent,
                    "distance_from_previous_km": None,
                })
            else:
                d = step.extra.get("distance_from_previous_km", 0.0)
                total_distance += d
                hops.append({"step": i, "factory_id": step.factory_id, "factory_name": step.factory_name,
                             "role": "processor", **step.extra})

        total_distance += last_distance
        hops.append({
            "step": len(path), "factory_id": buyer["factory_id"], "factory_name": buyer["factory_name"],
            "role": "destination", "material_id": state.material_id, "material_name": state.material_name,
            "purchase_price_per_tonne": buyer["purchase_price_per_tonne"],
            "distance_from_previous_km": last_distance,
        })

        route_key = ">".join(h["factory_id"] or "source" for h in hops)
        return {
            "route_key": route_key,
            "hops": hops,
            "final_material_id": state.material_id,
            "final_material_name": state.material_name,
            "destination_factory_id": buyer["factory_id"],
            "destination_factory_name": buyer["factory_name"],
            "total_distance_km": round(total_distance, 2),
            "hop_count": len(path),
            "status": "viable",
        }