# TKPI 2020 — Data Import Guide

## Primary source
- Publication: *Tabel Komposisi Pangan Indonesia* (TKPI), Kementerian Kesehatan RI, 2020.
- Source supplied in this project: PDF upload, 140 pages.
- Nutrition tables begin at printed page 9 and continue through printed page 72.
- Table values are stated per 100 gram BDD (bagian dapat dimakan). Keep BDD as a separate percentage field; do not scale the listed composition values by BDD again.

## Food groups and printed page ranges
| Group | TKPI group code (single / processed) | Printed pages |
|---|---|---:|
| Serealia dan hasil olahannya | AR / AP | 9–15 |
| Umbi berpati dan hasil olahannya | BR / BP | 16–21 |
| Kacang, biji, bean dan hasil olahannya | CR / CP | 22–29 |
| Sayuran dan hasil olahannya | DR / DP | 30–41 |
| Buah dan hasil olahannya | ER / EP | 42–47 |
| Daging, unggas dan hasil olahannya | FR / FP | 48–54 |
| Ikan, kerang, udang dan hasil olahannya | GR / GP | 55–64 |
| Telur dan hasil olahannya | HR / HP | 65–66 |
| Susu dan hasil olahannya | JR / JP | 67 |
| Lemak dan minyak | KR / KP | 68 |
| Gula, sirup dan konfeksioneri | MR / MP | 69 |
| Bumbu | NR / NP | 70–71 |
| Minuman | PR / PP | 72 |

## Nutrient column mapping
The import dictionary follows the TKPI table columns:
- Air (g), Energi (kkal), Protein (g), Lemak (g), Karbohidrat (g), Serat (g), Abu (g)
- Kalsium (mg), Fosfor (mg), Besi (mg), Natrium (mg), Kalium (mg), Tembaga (mg), Seng (mg)
- Retinol (µg), Beta-karoten (µg), Karoten total (µg)
- Thiamin (mg), Riboflavin (mg), Niasin (mg), Vitamin C (mg)
- BDD (%) is stored on the food record, not as a nutrient value.

## Import and quality rules
1. Preserve TKPI food codes and names exactly as printed; do not invent a code or silently normalize a food name.
2. Preserve source reference codes in `source_code` and record the printed page in `source_page`.
3. Keep blank cells as NULL. Do not convert blank to zero.
4. A printed zero remains zero. A dash, trace marker, or other symbol must be mapped only after checking the book's legend and notes.
5. Every OCR-extracted row must be checked against its PDF page image before import.
6. Keep source page and source version on every record.
7. Rows start as `pending`; do not publish until reviewed. Do not interpret this as a complete dataset until all table pages have been reconciled.
8. The PDF does not provide a machine-readable spreadsheet in the uploaded copy; table pages are scanned images. OCR is a draft aid only and is not authoritative.
9. Confirm the publication's reuse terms before republishing the complete table on a public/commercial website. Cite the Kementerian Kesehatan RI publication on each relevant page.

## Files
- `supabase/migrations/20261119_tkpi_2020_catalog.sql`: database alignment and staging table.
- `data/import-templates/tkpi-2020-foods.csv`: blank CSV header template.
- `supabase/nutrition-directory.sql`: original directory schema; apply it first on a fresh database, then apply the migration above.


## Controlled staging workflow

1. Populate the CSV template only from a source whose reuse is authorized.
2. Preserve every printed blank as an empty cell. Do not turn blanks, dashes, or trace symbols into zero.
3. Compare each row against the original PDF page at readable zoom. Record the printed page number.
4. Convert the prepared CSV to Supabase staging format:

```bash
python scripts/tkpi_csv_to_staging.py data/import-templates/tkpi-2020-foods.csv /tmp/tkpi-staging.csv --batch TKPI2020-serealia-01
```

5. Import `/tmp/tkpi-staging.csv` into `public.nutrition_import_staging` using the Supabase Table Editor. The converter always marks rows `pending`.
6. After a Bos Pangan admin reviews each row and changes `review_status` to `approved`, run:

```sql
select public.import_approved_tkpi_rows('TKPI2020-serealia-01');
```

7. The import function creates or updates food and nutrient rows as `reviewed`, but keeps `is_published = false`. Publication must be a separate admin decision after source-use permission and QA are confirmed.

The import function expects these JSON keys in `raw_row`: `category_slug`, `name`, `food_state`, `source_code`, `edible_portion_percent`, `source_version`, `source_url`, `review_notes`, and the 21 nutrient keys from the CSV template. Numeric fields accept decimal points and non-negative values only. Empty cells remain NULL; zero is retained as zero.


## PDF page rendering and OCR review

The supplied scanned PDF can be rendered page-by-page with Poppler and Tesseract:

```bash
python scripts/tkpi_render_ocr_review.py "Tabel Komposisi Pangan Indonesia.pdf" --out build/tkpi-ocr
```

Defaults cover physical PDF pages 13–76 (the printed table section, printed pages 9–72 in the supplied scan). Override `--first-page` and `--last-page` if using a differently assembled PDF. The output contains a page PNG, OCR text, and OCR TSV for each page.

A local smoke test on physical pages 14–15 completed successfully. It confirmed that the scan is image-based and that OCR text is imperfect: column headers, food codes, decimals, and blank cells are frequently misread. Therefore:
- OCR files are navigation/review aids only, not import-ready records.
- Never infer a value from a garbled OCR token.
- Inspect the high-resolution PNG for every value entered into the CSV.
- Keep uncertain cells blank and note them for a second review.
- Do not upload the generated page images or full OCR dump to the public repository; the original PDF remains the user's local source file.


## Additional converter validation

The CSV-to-staging converter also checks the TKPI group prefix and printed-page range before creating staging rows. For example, AR/AP codes must be assigned to the serealia group and printed pages 9–15. This catches common category/page mix-ups before a batch reaches Supabase.

Run the regression tests with:

```bash
python -m unittest discover -s tests -p "test_tkpi_*.py" -v
```

The tests cover zero-versus-blank handling, duplicate codes, group-prefix mismatch, out-of-range printed pages, negative values, and comma-decimal rejection. They do not validate the correctness of values transcribed from the PDF; that remains a visual source-review step.
