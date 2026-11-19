#!/usr/bin/env python3
"""Render TKPI PDF table pages and produce OCR review files.

This is an OCR-assistance step only. It deliberately does NOT turn OCR text
into nutrition values or insert anything into Supabase. Every cell must be
visually verified against the PDF before being entered into the CSV template.
Requires Poppler (pdftoppm) and Tesseract installed on PATH.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def require(command: str) -> str:
    path = shutil.which(command)
    if not path:
        raise SystemExit(f"Required command not found on PATH: {command}")
    return path


def run(args: list[str]) -> None:
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(args)}\n"
            f"{result.stderr.strip()}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Path to the authorized TKPI PDF")
    parser.add_argument("--out", type=Path, default=Path("build/tkpi-ocr"))
    parser.add_argument("--first-page", type=int, default=13,
                        help="First physical PDF page (default: 13; printed table page 9)")
    parser.add_argument("--last-page", type=int, default=76,
                        help="Last physical PDF page (default: 76; printed table page 72)")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--lang", default="ind+eng")
    args = parser.parse_args()

    if not args.pdf.is_file():
        raise SystemExit(f"PDF not found: {args.pdf}")
    if args.first_page < 1 or args.last_page < args.first_page:
        raise SystemExit("Invalid PDF page range")
    if args.dpi < 200:
        raise SystemExit("Use at least 200 DPI for table review")

    pdftoppm = require("pdftoppm")
    tesseract = require("tesseract")
    args.out.mkdir(parents=True, exist_ok=True)

    manifest = [
        "TKPI OCR REVIEW OUTPUT",
        f"Source file: {args.pdf.name}",
        f"Physical PDF pages: {args.first_page}-{args.last_page}",
        f"Render DPI: {args.dpi}",
        f"OCR languages: {args.lang}",
        "",
        "WARNING: OCR is a draft aid. Numeric cells are not certified.",
        "Compare every food code, name, value, unit and BDD against the page image.",
        "Do not import OCR text directly into production.",
        "",
    ]

    for page in range(args.first_page, args.last_page + 1):
        stem = f"pdf-page-{page:03d}"
        image = args.out / f"{stem}.png"
        base = args.out / stem
        run([pdftoppm, "-f", str(page), "-l", str(page), "-r", str(args.dpi),
             "-png", "-singlefile", str(args.pdf), str(base)])
        run([tesseract, str(image), str(base), "-l", args.lang,
             "--psm", "6", "txt", "tsv"])
        manifest.append(f"{stem}: {image.name}, {stem}.txt, {stem}.tsv")

    (args.out / "README.txt").write_text("\n".join(manifest) + "\n", encoding="utf-8")
    print(f"Rendered {args.last_page - args.first_page + 1} pages to {args.out}")
    print("OCR files are review aids only; no nutrition data was imported.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
