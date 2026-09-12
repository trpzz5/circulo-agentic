"""Generates real PDF manifests for the demo — including the Golden Path one.

Run once:
    python -m app.services.generate_sample_manifest

Produces two files under data/manifests/:
    golden_path_manifest.pdf   — matches the Golden Path exactly
    scrap_metal_manifest.pdf   — a DIFFERENT material, proving extraction is
                                 real and not hardcoded to always return the
                                 Golden Path fixture.
"""

from __future__ import annotations

import logging

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from app.config import get_settings

logger = logging.getLogger(__name__)


def _write_manifest_pdf(path, title: str, lines: list[str]) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(2 * cm, height - 2.5 * cm, title)

    c.setFont("Helvetica", 11)
    y = height - 4 * cm
    for line in lines:
        c.drawString(2 * cm, y, line)
        y -= 0.8 * cm

    c.showPage()
    c.save()


def run() -> None:
    settings = get_settings()
    out_dir = settings.manifest_upload_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    golden_path = out_dir / "golden_path_manifest.pdf"
    _write_manifest_pdf(
        golden_path,
        "WASTE MANIFEST",
        [
            "Manifest No: WM-2026-0417",
            "Source Factory: ABC Foundry",
            "Location: Mangalore",
            "",
            "Material: Foundry Sand",
            "Quantity: 20 tonnes/month",
            "Moisture: 12%",
            "Purity: 94%",
            "Embedded Carbon: 1200 kg CO2e",
            "",
            "Declared by: Plant Operations, ABC Foundry",
        ],
    )
    logger.info("Wrote %s", golden_path)

    scrap_metal = out_dir / "scrap_metal_manifest.pdf"
    _write_manifest_pdf(
        scrap_metal,
        "WASTE MANIFEST",
        [
            "Manifest No: WM-2026-0512",
            "Source Factory: Konkan Steel Works",
            "Location: Udupi",
            "",
            "Material: Scrap Metal",
            "Quantity: 35 tonnes/month",
            "Moisture: 3%",
            "Purity: 97%",
            "Embedded Carbon: 400 kg CO2e",
            "",
            "Declared by: Plant Operations, Konkan Steel Works",
        ],
    )
    logger.info("Wrote %s", scrap_metal)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    run()