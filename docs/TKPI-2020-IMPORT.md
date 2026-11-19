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
