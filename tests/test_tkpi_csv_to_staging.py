from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "tkpi_csv_to_staging.py"
TEMPLATE = ROOT / "data" / "import-templates" / "tkpi-2020-foods.csv"


class TkpiCsvConverterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.input_path = Path(self.temp.name) / "input.csv"
        self.output_path = Path(self.temp.name) / "staging.csv"
        with TEMPLATE.open(encoding="utf-8", newline="") as source:
            self.headers = next(csv.reader(source))

    def row(self, **overrides: str) -> dict[str, str]:
        row = {header: "" for header in self.headers}
        row.update({
            "tkpi_code": "AR001",
            "category_slug": "serealia",
            "name": "Beras contoh",
            "source_code": "KZDM-2001",
            "source_page": "9",
            "water_g": "0",
            "energy_kcal": "",
            "edible_portion_percent": "100",
        })
        row.update(overrides)
        return row

    def run_converter(self, rows: list[dict[str, str]]) -> subprocess.CompletedProcess[str]:
        with self.input_path.open("w", encoding="utf-8", newline="") as target:
            writer = csv.DictWriter(target, fieldnames=self.headers)
            writer.writeheader()
            writer.writerows(rows)
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(self.input_path), str(self.output_path),
             "--batch", "test-batch"],
            text=True, capture_output=True, check=False,
        )

    def test_zero_is_preserved_and_blank_remains_null(self) -> None:
        result = self.run_converter([self.row()])
        self.assertEqual(result.returncode, 0, result.stderr)
        with self.output_path.open(encoding="utf-8", newline="") as source:
            staging = next(csv.DictReader(source))
        raw = json.loads(staging["raw_row"])
        self.assertEqual(raw["water_g"], "0")
        self.assertIsNone(raw["energy_kcal"])
        self.assertEqual(staging["review_status"], "pending")

    def test_category_prefix_mismatch_is_rejected(self) -> None:
        result = self.run_converter([self.row(tkpi_code="DR001")])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not belong", result.stderr)

    def test_printed_page_outside_group_is_rejected(self) -> None:
        result = self.run_converter([self.row(source_page="16")])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("outside serealia range", result.stderr)

    def test_negative_nutrient_is_rejected(self) -> None:
        result = self.run_converter([self.row(protein_g="-1")])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("non-negative decimal", result.stderr)

    def test_comma_decimal_is_rejected_instead_of_silently_rewritten(self) -> None:
        result = self.run_converter([self.row(protein_g="1,25")])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("non-negative decimal", result.stderr)

    def test_duplicate_tkpi_code_is_rejected(self) -> None:
        result = self.run_converter([self.row(), self.row(name="Duplikat")])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate TKPI code", result.stderr)


if __name__ == "__main__":
    unittest.main()
