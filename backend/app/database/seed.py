"""Seeds the synthetic industrial network, including the Golden Path.

Run manually, once, after schema creation:
    python -m app.database.seed

Idempotent: if factories already exist, it reports and exits without
duplicating rows. To force a clean reseed, pass --reset.
"""

from __future__ import annotations

import argparse
import logging

from app.database import apply_schema, get_connection

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════
#  Materials
# ══════════════════════════════════════════════════════════════════════════

MATERIALS: list[tuple[str, str, str]] = [
    # (material_id, name, category)
    ("foundry_sand",           "Foundry Sand",            "mineral_waste"),
    ("processed_foundry_sand", "Processed Foundry Sand",  "mineral_waste"),
    ("scrap_metal",            "Scrap Metal",              "metal"),
    ("fly_ash",                "Fly Ash",                  "industrial_byproduct"),
    ("processed_fly_ash",      "Processed Fly Ash",        "industrial_byproduct"),
    ("slag",                   "Slag",                     "metal_byproduct"),
    ("construction_debris",    "Construction Debris",      "construction_waste"),
]

# ══════════════════════════════════════════════════════════════════════════
#  Factories — 13 entities across the categories your spec requires
# ══════════════════════════════════════════════════════════════════════════

FACTORIES: list[dict] = [
    dict(factory_id="abc_foundry", factory_name="ABC Foundry", industry="Foundry",
         location="Mangalore", latitude=12.9141, longitude=74.8560,
         capacity_tonnes_per_month=20, transportation_rate_per_km=30,
         notes="Golden Path source. Produces Foundry Sand at 12% moisture."),

    dict(factory_id="cement_plant_x", factory_name="Sagar Cement Works", industry="Cement",
         location="Mangalore", latitude=12.8698, longitude=74.8420,
         capacity_tonnes_per_month=500, transportation_rate_per_km=30,
         notes="Golden Path direct-match target. Rejects Foundry Sand above 10% moisture."),

    dict(factory_id="coastal_cement", factory_name="Coastal Cement Ltd", industry="Cement",
         location="Udupi", latitude=13.3409, longitude=74.7421,
         capacity_tonnes_per_month=350, transportation_rate_per_km=32,
         notes="Even stricter moisture tolerance than Cement Plant X."),

    dict(factory_id="processor_y", factory_name="Dakshina Processing Solutions", industry="Recycling Processor",
         location="Bantwal", latitude=12.8347, longitude=75.0369,
         capacity_tonnes_per_month=200, transportation_rate_per_km=28,
         notes="Golden Path processor. Dries Foundry Sand from up to 25% moisture down to ~5%."),

    dict(factory_id="glass_mfr_z", factory_name="Karavali Glass Industries", industry="Glass Manufacturing",
         location="Mangalore", latitude=12.9718, longitude=74.8232,
         capacity_tonnes_per_month=150, transportation_rate_per_km=30,
         notes="Golden Path final destination. Accepts only processed sand."),

    dict(factory_id="western_glass", factory_name="Western Glass Co", industry="Glass Manufacturing",
         location="Udupi", latitude=13.3298, longitude=74.7526,
         capacity_tonnes_per_month=120, transportation_rate_per_km=32,
         notes="Alternative glass buyer, stricter moisture spec."),

    dict(factory_id="malabar_metal", factory_name="Malabar Metal Recyclers", industry="Metal Processor",
         location="Mangalore", latitude=12.9012, longitude=74.8890,
         capacity_tonnes_per_month=300, transportation_rate_per_km=27,
         notes="Buys scrap metal and slag."),

    dict(factory_id="udupi_steel", factory_name="Udupi Steel Works", industry="Metal Processor",
         location="Udupi", latitude=13.3427, longitude=74.7139,
         capacity_tonnes_per_month=400, transportation_rate_per_km=31,
         notes="Second metal/slag buyer for route comparison."),

    dict(factory_id="netravati_chemicals", factory_name="Netravati Chemicals", industry="Chemical Plant",
         location="Mangalore", latitude=12.8534, longitude=74.8123,
         capacity_tonnes_per_month=180, transportation_rate_per_km=29,
         notes="Buys fly ash as a feedstock."),

    dict(factory_id="buildright_construction", factory_name="BuildRight Constructions", industry="Construction",
         location="Mangalore", latitude=12.9345, longitude=74.8901,
         capacity_tonnes_per_month=600, transportation_rate_per_km=25,
         notes="Low-value direct buyer of raw Foundry Sand for road base — the 'Direct Sale' what-if strategy."),

    dict(factory_id="coastline_logistics", factory_name="CoastLine Logistics", industry="Logistics Provider",
         location="Mangalore", latitude=12.9000, longitude=74.8500,
         capacity_tonnes_per_month=0, transportation_rate_per_km=28,
         notes="Reference logistics provider; no material acceptance."),

    dict(factory_id="dakshina_waste", factory_name="Dakshina Waste Solutions", industry="Waste Processor",
         location="Bantwal", latitude=12.8900, longitude=75.0100,
         capacity_tonnes_per_month=1000, transportation_rate_per_km=26,
         notes="Landfill/disposal baseline — worst-case comparison, not a circular route."),

    dict(factory_id="green_circuit_recyclers", factory_name="Green Circuit Recyclers", industry="Recycling Processor",
         location="Mangalore", latitude=12.9450, longitude=74.8700,
         capacity_tonnes_per_month=220, transportation_rate_per_km=27,
         notes="Beneficiates fly ash into a higher-purity output."),
]

# ══════════════════════════════════════════════════════════════════════════
#  Accepted materials — (factory_id, material_id, moisture_limit, purity_req,
#                         purchase_price_per_tonne, processing_cost_per_tonne)
# ══════════════════════════════════════════════════════════════════════════

ACCEPTED: list[tuple] = [
    # Golden Path — Cement Plant X REJECTS ABC Foundry's 12% moisture sand
    ("cement_plant_x", "foundry_sand", 10.0, 90.0, 800.0, 0.0),
    ("coastal_cement", "foundry_sand", 8.0, 92.0, 750.0, 0.0),

    # Golden Path — Processor Y buys wet sand cheap, dries it
    ("processor_y", "foundry_sand", 25.0, 80.0, 300.0, 450.0),
    ("processor_y", "fly_ash", 20.0, 75.0, 250.0, 380.0),

    # Golden Path — Glass manufacturers only take PROCESSED sand
    ("glass_mfr_z", "processed_foundry_sand", 8.0, 90.0, 1400.0, 0.0),
    ("western_glass", "processed_foundry_sand", 6.0, 92.0, 1500.0, 0.0),

    # Metal / slag buyers
    ("malabar_metal", "scrap_metal", 100.0, 60.0, 1800.0, 0.0),
    ("malabar_metal", "slag", 100.0, 50.0, 200.0, 0.0),
    ("udupi_steel", "scrap_metal", 100.0, 55.0, 1700.0, 0.0),
    ("udupi_steel", "slag", 100.0, 45.0, 180.0, 0.0),

    # Chemical plant
    ("netravati_chemicals", "fly_ash", 15.0, 70.0, 600.0, 0.0),

    # The realistic "Direct Sale" what-if — low value, but a genuine direct match
    ("buildright_construction", "foundry_sand", 15.0, 60.0, 200.0, 0.0),
    ("buildright_construction", "construction_debris", 100.0, 40.0, 150.0, 0.0),

    # Disposal baseline (worst case — not circular)
    ("dakshina_waste", "foundry_sand", 100.0, 0.0, 50.0, 0.0),

    # Fly ash beneficiation input
    ("green_circuit_recyclers", "fly_ash", 30.0, 60.0, 180.0, 320.0),
]

# ══════════════════════════════════════════════════════════════════════════
#  Explicit categorical rejections — structural, not spec-based
# ══════════════════════════════════════════════════════════════════════════

REJECTED: list[tuple[str, str, str]] = [
    ("cement_plant_x", "scrap_metal", "not_applicable_to_industry"),
    ("coastal_cement", "scrap_metal", "not_applicable_to_industry"),
    # The key structural fact that forces the multi-hop route to exist:
    ("glass_mfr_z", "foundry_sand", "raw_material_rejected_requires_processing"),
    ("western_glass", "foundry_sand", "raw_material_rejected_requires_processing"),
]

# ══════════════════════════════════════════════════════════════════════════
#  Processing routes — the transformation graph
# ══════════════════════════════════════════════════════════════════════════

PROCESSING_ROUTES: list[dict] = [
    dict(route_id="route_y_dries_sand", processor_factory_id="processor_y",
         input_material_id="foundry_sand", output_material_id="processed_foundry_sand",
         output_moisture_percent=5.0, output_purity_percent=96.0,
         processing_cost_per_tonne=450.0,
         description="Rotary drum drying reduces moisture from up to 25% to ~5% "
                      "and lifts effective purity by removing residual binder."),

    dict(route_id="route_green_upgrades_flyash", processor_factory_id="green_circuit_recyclers",
         input_material_id="fly_ash", output_material_id="processed_fly_ash",
         output_moisture_percent=8.0, output_purity_percent=88.0,
         processing_cost_per_tonne=320.0,
         description="Mechanical beneficiation raises fly ash purity for chemical feedstock use."),
]


def _seed(conn) -> None:
    conn.executemany(
        "INSERT INTO materials (material_id, name, category) VALUES (?, ?, ?)",
        MATERIALS,
    )
    conn.executemany(
        """
        INSERT INTO factories
            (factory_id, factory_name, industry, location, latitude, longitude,
             capacity_tonnes_per_month, transportation_rate_per_km, notes)
        VALUES
            (:factory_id, :factory_name, :industry, :location, :latitude, :longitude,
             :capacity_tonnes_per_month, :transportation_rate_per_km, :notes)
        """,
        FACTORIES,
    )
    conn.executemany(
        """
        INSERT INTO factory_accepted_materials
            (factory_id, material_id, moisture_limit_percent, purity_requirement_percent,
             purchase_price_per_tonne, processing_cost_per_tonne)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        ACCEPTED,
    )
    conn.executemany(
        "INSERT INTO factory_rejected_materials (factory_id, material_id, reason) VALUES (?, ?, ?)",
        REJECTED,
    )
    conn.executemany(
        """
        INSERT INTO processing_routes
            (route_id, processor_factory_id, input_material_id, output_material_id,
             output_moisture_percent, output_purity_percent, processing_cost_per_tonne, description)
        VALUES
            (:route_id, :processor_factory_id, :input_material_id, :output_material_id,
             :output_moisture_percent, :output_purity_percent, :processing_cost_per_tonne, :description)
        """,
        PROCESSING_ROUTES,
    )


def run(reset: bool = False) -> None:
    apply_schema()

    with get_connection() as conn:
        existing = conn.execute("SELECT COUNT(*) AS c FROM factories").fetchone()["c"]

        if existing and not reset:
            logger.info("Seed skipped — %d factories already present. Use --reset to reseed.", existing)
            return

        if existing and reset:
            logger.info("Resetting: clearing existing domain data.")
            for table in (
                "processing_routes", "factory_rejected_materials",
                "factory_accepted_materials", "factories", "materials",
            ):
                conn.execute(f"DELETE FROM {table}")

        _seed(conn)
        count = conn.execute("SELECT COUNT(*) AS c FROM factories").fetchone()["c"]
        logger.info("Seeded %d factories, %d materials.", count, len(MATERIALS))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    parser = argparse.ArgumentParser(description="Seed the CIRCULO synthetic industrial network.")
    parser.add_argument("--reset", action="store_true", help="Clear existing domain data before reseeding.")
    args = parser.parse_args()
    run(reset=args.reset)