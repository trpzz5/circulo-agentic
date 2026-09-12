-- CIRCULO domain schema — Phase 2.
-- All CREATE statements are idempotent (IF NOT EXISTS) so this file can be
-- re-run safely on every startup without wiping existing data.

-- ── Canonical material catalog ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
    material_id TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    category    TEXT NOT NULL DEFAULT 'general'
);

-- ── Industrial entities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factories (
    factory_id                  TEXT PRIMARY KEY,
    factory_name                TEXT NOT NULL,
    industry                    TEXT NOT NULL,
    location                    TEXT NOT NULL,
    latitude                    REAL NOT NULL,
    longitude                   REAL NOT NULL,
    capacity_tonnes_per_month   REAL NOT NULL DEFAULT 0,
    transportation_rate_per_km  REAL NOT NULL DEFAULT 30.0,
    notes                       TEXT
);

-- ── What a factory will BUY, and under what spec (per-material limits) ──────
-- This is where moisture_limit / purity_requirement actually live — they are
-- properties of a (factory, material) pair, not of the factory alone.
CREATE TABLE IF NOT EXISTS factory_accepted_materials (
    factory_id                  TEXT NOT NULL REFERENCES factories(factory_id) ON DELETE CASCADE,
    material_id                 TEXT NOT NULL REFERENCES materials(material_id) ON DELETE CASCADE,
    moisture_limit_percent      REAL,
    purity_requirement_percent  REAL,
    purchase_price_per_tonne    REAL NOT NULL DEFAULT 0,
    processing_cost_per_tonne   REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (factory_id, material_id)
);

-- ── Explicit, categorical refusals — independent of spec limits ─────────────
-- A row here means "never, regardless of quality" (e.g. a glass plant will
-- never take RAW foundry sand, only processed). Distinct from failing a
-- moisture/purity check on an otherwise-accepted material.
CREATE TABLE IF NOT EXISTS factory_rejected_materials (
    factory_id   TEXT NOT NULL REFERENCES factories(factory_id) ON DELETE CASCADE,
    material_id  TEXT NOT NULL REFERENCES materials(material_id) ON DELETE CASCADE,
    reason       TEXT NOT NULL,
    PRIMARY KEY (factory_id, material_id)
);

-- ── The transformation graph — what multi-hop discovery walks ───────────────
-- A row says: "this factory can take input_material and produce
-- output_material with these new properties." Discovery Agent (Phase 4)
-- joins this against factory_accepted_materials to find hops.
CREATE TABLE IF NOT EXISTS processing_routes (
    route_id                    TEXT PRIMARY KEY,
    processor_factory_id        TEXT NOT NULL REFERENCES factories(factory_id) ON DELETE CASCADE,
    input_material_id           TEXT NOT NULL REFERENCES materials(material_id),
    output_material_id          TEXT NOT NULL REFERENCES materials(material_id),
    output_moisture_percent     REAL,
    output_purity_percent       REAL,
    processing_cost_per_tonne   REAL NOT NULL DEFAULT 0,
    description                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_accepted_material   ON factory_accepted_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_rejected_material   ON factory_rejected_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_routes_input        ON processing_routes(input_material_id);
CREATE INDEX IF NOT EXISTS idx_routes_output       ON processing_routes(output_material_id);
CREATE INDEX IF NOT EXISTS idx_routes_processor     ON processing_routes(processor_factory_id);