#!/usr/bin/env python3
"""Convert reviewed TKPI CSV rows into Supabase nutrition_import_staging CSV.

This utility does not OCR the PDF and does not certify values. Fill the source
CSV from an authorized source, verify every row against its page image, then
run this script. Output rows are always pending review.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

NUTRIENTS = {
    "water_g", "energy_kcal", "protein_g", "fat_g", "carbohydrate_g",
    "fiber_g", "ash_g", "calcium_mg", "phosphorus_mg", "iron_mg",
    "sodium_mg", "potassium_mg", "copper_mg", "zinc_mg", "retinol_ug",
    "beta_carotene_ug", "total_carotene_ug", "thiamin_mg",
    "riboflavin_mg", "niacin_mg", "vitamin_c_mg",
}
NUMERIC = NUTRIENTS | {"edible_portion_percent"}
REQUIRED = {"tkpi_code", "category_slug", "name", "source_page"}
STAGING_FIELDS = [
    "batch_name", "tkpi_code", "source_page", "raw_row",
    "ocr_confidence", "review_status", "review_notes",
]


def clean_number(value: str, field: str, row_num: int) -> str | None:
    value = value.strip()
    if not value:
        return None
    if not re.fullmatch(r"(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)", value):
        raise ValueError(f"row {row_num}: {field} must be a non-negative decimal using dot")
    if field == "edible_portion_percent" and not (0 <= float(value) <= 100):
        raise ValueError(f"row {row_num}: BDD must be between 0 and 100")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_csv", type=Path)
    parser.add_argument("output_csv", type=Path)
    parser.add_argument("--batch", required=True, help="e.g. TKPI2020-serealia-2026-11")
    args = parser.parse_args()

    with args.input_csv.open("r", encoding="utf-8-sig", newline="") as src:
        reader = csv.DictReader(src)
        headers = set(reader.fieldnames or [])
        missing = REQUIRED - headers
        if missing:
            raise SystemExit("Missing columns: " + ", ".join(sorted(missing)))
        extra_nutrients = NUTRIENTS - headers
        if extra_nutrients:
            raise SystemExit("Missing nutrient columns: " + ", ".join(sorted(extra_nutrients)))

        with args.output_csv.open("w", encoding="utf-8", newline="") as dst:
            writer = csv.DictWriter(dst, fieldnames=STAGING_FIELDS)
            writer.writeheader()
            count = 0
            seen_codes: set[str] = set()
            for row_num, row in enumerate(reader, start=2):
                code = (row.get("tkpi_code") or "").strip()
                name = (row.get("name") or "").strip()
                category = (row.get("category_slug") or "").strip()
                page_text = (row.get("source_page") or "").strip()
                if not code or not name or not category or not page_text:
                    raise ValueError(f"row {row_num}: TKPI code, name, category_slug, and source_page are required")
                if code in seen_codes:
                    raise ValueError(f"row {row_num}: duplicate TKPI code {code}")
                seen_codes.add(code)
                if not page_text.isdigit() or int(page_text) < 1:
                    raise ValueError(f"row {row_num}: source_page must be a positive printed page number")

                raw = {}
                for key, value in row.items():
                    if key in {"tkpi_code", "source_page", "data_quality_status"}:
                        continue
                    value = (value or "").strip()
                    if key in NUMERIC:
                        raw[key] = clean_number(value, key, row_num)
                    elif key:
                        raw[key] = value or None
                raw["category_slug"] = category
                raw["name"] = name
                raw["source_version"] = raw.get("source_version") or "2020"
                raw["source_name"] = raw.get("source_name") or "Tabel Komposisi Pangan Indonesia"
                writer.writerow({
                    "batch_name": args.batch,
                    "tkpi_code": code,
                    "source_page": page_text,
                    "raw_row": json.dumps(raw, ensure_ascii=False, separators=(",", ":")),
                    "ocr_confidence": "",
                    "review_status": "pending",
                    "review_notes": "Menunggu pemeriksaan admin terhadap PDF sumber",
                })
                count += 1

    print(f"Prepared {count} pending staging rows: {args.output_csv}")
    print("No row was approved, imported, or published.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
