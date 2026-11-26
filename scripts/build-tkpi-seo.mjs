import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SITE = "https://www.bospangan.com";
const DATA_FILE = path.join(ROOT, "nutrisi/tkpi-2017/pangan.json");
const SITEMAP_FILE = path.join(ROOT, "sitemap.xml");
const OUTPUT_DIR = path.join(ROOT, "nutrisi/tkpi-2017/pangan");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const slugify = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const foodSlug = (food, index) => {
  const code = String(food.kode || "item-" + (index + 1)).toLowerCase();
  return slugify(food.nama_bahan) + "-" + slugify(code);
};

const formatNumber = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return "Tidak tercantum";
  return raw.replace(".", ",");
};

const labelFor = (field) => {
  const labels = {
    air: "Air", energi: "Energi", protein: "Protein", lemak: "Lemak",
    karbohidrat: "Karbohidrat", serat: "Serat", abu: "Abu",
    kalsium: "Kalsium", fosfor: "Fosfor", besi: "Besi",
    natrium: "Natrium", kalium: "Kalium", tembaga: "Tembaga",
    seng: "Seng", retinol: "Retinol", beta_karoten: "Beta-karoten",
    karoten_total: "Karoten total", thiamin: "Tiamin (B1)",
    riboflavin: "Riboflavin (B2)", niasin: "Niasin (B3)",
    vitamin_c: "Vitamin C", bdd_persen: "Bagian dapat dimakan (BDD)"
  };
  const name = field.replace(/_(g|mg|mcg|kkal|persen)$/, "");
  return labels[name] || name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
};

const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
if (!Array.isArray(data.fields) || !Array.isArray(data.foods)) {
  throw new Error("Format pangan.json tidak valid: fields/foods tidak ditemukan.");
}

const fields = data.fields;
const indexByField = Object.fromEntries(fields.map((field, index) => [field, index]));
const nutrientFields = fields.filter((field) => /_(g|mg|mcg|kkal)$/.test(field));
const foodRows = data.foods.map((row) =>
  Object.fromEntries(fields.map((field, index) => [field, row[index] ?? ""]))
);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sitemapUrls = new Set();
if (fs.existsSync(SITEMAP_FILE)) {
  const existing = fs.readFileSync(SITEMAP_FILE, "utf8").replaceAll("https://bospangan.com", SITE);
  for (const match of existing.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
    const url = match[1].trim();
    if (!url.includes("/nutrisi/tkpi-2017/pangan/")) sitemapUrls.add(url);
  }
}
sitemapUrls.add(SITE + "/");
sitemapUrls.add(SITE + "/nutrisi/tkpi-2017/");

let generated = 0;
let indexable = 0;
for (const [index, food] of foodRows.entries()) {
  const code = String(food.kode || "").trim();
  if (!code) continue;

  const slug = foodSlug(food, index);
  const relativePath = "/nutrisi/tkpi-2017/pangan/" + slug + "/";
  const canonical = SITE + relativePath;
  const outputPath = path.join(OUTPUT_DIR, slug, "index.html");
  const hasSourcePage = Boolean(String(food.halaman_komposisi || "").trim());
  const hasNutritionValues = nutrientFields.some((field) => {
    const value = String(food[field] ?? "").trim();
    return value !== "" && value !== "-";
  });
  const indexablePage = hasSourcePage && hasNutritionValues;
  const title = String(food.nama_bahan || "Bahan pangan") + " (" + code + ") – Komposisi Gizi TKPI 2017 | Bos Pangan";
  const description = "Informasi komposisi gizi " + String(food.nama_bahan || "bahan pangan") +
    " per 100 gram bagian yang dapat dimakan, berdasarkan data TKPI 2017. Kode pangan " + code + ".";
  const nutrientRows = nutrientFields.map((field) => {
    const unit = field.slice(field.lastIndexOf("_") + 1);
    const value = formatNumber(food[field]);
    return "<tr><th scope=\"row\">" + escapeHtml(labelFor(field)) + "</th><td>" +
      escapeHtml(value === "Tidak tercantum" ? value : value + " " + unit) + "</td></tr>";
  }).join("\n");
  const detailItems = [
    ["Kode pangan", code],
    ["Kelompok", food.kelompok],
    ["Tipe bahan", food.jenis === "tunggal/single" ? "Tunggal" : food.jenis === "olahan/produk/komposit" ? "Olahan / produk / komposit" : food.jenis],
    ["Nama ilmiah", food.nama_latin_spesies],
    ["Nama lokal / daerah", food.nama_daerah_lokal],
    ["Nama Inggris", food.nama_inggris],
    ["Keterangan", food.keterangan_masakan],
    ["Sumber data", food.sumber],
    ["Halaman sumber", food.halaman_komposisi],
    ["Bagian dapat dimakan", food.bdd_persen ? food.bdd_persen + "%" : ""]
  ].filter(([, value]) => String(value ?? "").trim() !== "");
  const details = detailItems.map(([label, value]) =>
    "<div><dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) + "</dd></div>"
  ).join("\n");

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${indexablePage ? "index,follow" : "noindex,follow"}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/assets/bospangan-icon.svg">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<style>
:root{color-scheme:light;--ink:#193e34;--green:#0d461a;--line:#dce3d7;--paper:#fbfcf8}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,sans-serif}
header{background:var(--green);padding:16px 4%}header a{color:#fff;text-decoration:none;font-weight:800}
main{width:min(920px,92%);margin:34px auto 64px}.crumb{font-size:14px;color:#627267}.crumb a{color:#176343}
h1{font:700 clamp(32px,5vw,52px)/1.12 Georgia,serif;letter-spacing:-.035em;margin:10px 0}
.lead{font-size:18px;color:#53675c}.panel{background:#f0f4e9;border-radius:14px;padding:18px 22px;margin:24px 0}
dl{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
dt{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#617267}dd{margin:2px 0 0;font-weight:650}
.table-wrap{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:12px}
table{width:100%;border-collapse:collapse}th,td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--line)}
thead th{background:#edf2e8}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
footer{padding:22px 4%;background:#f1f4eb;color:#617267;font-size:14px}
@media(max-width:560px){main{margin-top:22px}.panel{padding:15px}th,td{padding:9px 10px}}
</style>
</head>
<body>
<header><a href="/">BOS PANGAN · Juara Pangan Lokal</a></header>
<main>
<nav class="crumb"><a href="/nutrisi/">Pusat Nutrisi</a> / <a href="/nutrisi/tkpi-2017/">Direktori TKPI 2017</a> / ${escapeHtml(code)}</nav>
<h1>${escapeHtml(food.nama_bahan || "Bahan pangan")}</h1>
<p class="lead">${escapeHtml(description)}</p>
<section class="panel"><h2>Identitas bahan pangan</h2><dl>${details}</dl></section>
<h2>Komposisi zat gizi</h2>
<p>Nilai disajikan per 100 gram bagian yang dapat dimakan, mengikuti keterangan dataset TKPI 2017. Tanda “Tidak tercantum” berarti nilai tidak tersedia pada entri sumber.</p>
<div class="table-wrap"><table><thead><tr><th scope="col">Komponen</th><th scope="col">Nilai per 100 g</th></tr></thead><tbody>${nutrientRows}</tbody></table></div>
<section class="panel"><h2>Catatan sumber</h2><p>Data rujukan: Tabel Komposisi Pangan Indonesia (TKPI) 2017, Kementerian Kesehatan Republik Indonesia. Informasi ini disajikan untuk referensi komposisi pangan.</p><p><a href="/nutrisi/tkpi-2017/">Kembali ke direktori TKPI 2017</a></p></section>
</main>
<footer>© Bos Pangan · Juara Pangan Lokal</footer>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
  generated++;
  if (indexablePage) {
    sitemapUrls.add(canonical);
    indexable++;
  }
}

const xmlEscape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...sitemapUrls].sort().map((url) => "  <url><loc>" + xmlEscape(url) + "</loc></url>").join("\n") +
  "\n</urlset>\n";
fs.writeFileSync(SITEMAP_FILE, sitemap, "utf8");

console.log("TKPI SEO build selesai: " + generated + " halaman dibuat, " + indexable +
  " URL masuk sitemap, " + sitemapUrls.size + " total URL sitemap.");
