import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { renderArticle } from "./render-blog.mjs";

const root = process.cwd();
const config = await readFile(path.join(root, "auth-config.js"), "utf8");
const urlMatch = config.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
const keyMatch = config.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/);
if (!urlMatch || !keyMatch) throw new Error("Konfigurasi Supabase tidak ditemukan di auth-config.js.");

const supabaseUrl = urlMatch[1].replace(/\/$/, "");
const publicKey = keyMatch[1];
const endpoint = new URL(supabaseUrl + "/rest/v1/cms_articles");
endpoint.searchParams.set("select", "title,slug,excerpt,category,seo_title,seo_description,focus_keyphrase,seo_metadata,cover_image_url,cover_image_alt,featured_image_url,featured_image_alt,published_at,updated_at,content_markdown,content_html,content_type,status");
endpoint.searchParams.set("content_type", "eq.blog");
endpoint.searchParams.set("status", "eq.published");
endpoint.searchParams.set("published_at", "lte." + new Date().toISOString());
endpoint.searchParams.set("order", "published_at.desc");

const response = await fetch(endpoint, {
  headers: { apikey: publicKey, Authorization: "Bearer " + publicKey, Accept: "application/json" }
});
if (!response.ok) {
  throw new Error("Supabase REST gagal: HTTP " + response.status + " " + (await response.text()));
}
const articles = await response.json();
if (!Array.isArray(articles) || articles.length === 0) {
  throw new Error("Tidak ada artikel Blog published; file lama tidak dihapus.");
}

const blogDir = path.join(root, "blog");
const keep = new Set();
for (const article of articles) {
  const slug = String(article.slug || "");
  const folder = path.join(blogDir, slug);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "index.html"), renderArticle(article), "utf8");
  keep.add(slug);
  console.log("Generated /blog/" + slug + "/");
}
for (const entry of await readdir(blogDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || keep.has(entry.name)) continue;
  const oldPage = path.join(blogDir, entry.name, "index.html");
  try {
    const oldHtml = await readFile(oldPage, "utf8");
    if (oldHtml.includes("GENERATED_BY_BOS_PANGAN_BLOG_BUILD")) {
      await rm(path.join(blogDir, entry.name), { recursive: true, force: true });
      console.log("Removed unpublished article /blog/" + entry.name + "/");
    }
  } catch {}
}
// Keep the public Blog index and replace generated article URLs in the sitemap.
const sitemapPath = path.join(root, "sitemap.xml");
const sitemapSource = await readFile(sitemapPath, "utf8");
const sitemapHeader = sitemapSource.match(/<\?xml[^>]*\?>\s*<urlset[^>]*>/);
if (!sitemapHeader) throw new Error("Struktur sitemap.xml tidak dikenali.");
const existingUrls = sitemapSource.match(/<url>[\s\S]*?<\/url>/g) || [];
const keptUrls = existingUrls.filter(entry => {
  const loc = (entry.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1] || "";
  return !/^https:\/\/bospangan\.com\/blog\/.+\/$/.test(loc);
});
if (!keptUrls.some(entry => (entry.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1] === "https://bospangan.com/blog/")) {
  keptUrls.push("<url><loc>https://bospangan.com/blog/</loc></url>");
}
for (const article of articles) {
  let seoMetadata = article.seo_metadata || {};
  if (typeof seoMetadata === "string") {
    try { seoMetadata = JSON.parse(seoMetadata); } catch { seoMetadata = {}; }
  }
  const advanced = seoMetadata.advanced || {};
  const canonicalDefault = "https://bospangan.com/blog/" + article.slug + "/";
  const customCanonical = String(advanced.canonicalUrl || "").trim();
  const hasCustomCanonical = /^https:\/\/[^\\s"'<>]+$/i.test(customCanonical) && customCanonical !== canonicalDefault;
  if (advanced.noIndex || hasCustomCanonical) continue;
  const lastmodValue = article.updated_at || article.published_at;
  const lastmod = lastmodValue ? new Date(lastmodValue).toISOString() : "";
  keptUrls.push("<url><loc>" + canonicalDefault + "</loc>" +
    (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") + "</url>");
}
await writeFile(sitemapPath, sitemapHeader[0] + "\n" + keptUrls.join("\n") + "\n</urlset>\n", "utf8");
console.log("Static Blog build completed: " + articles.length + " articles; sitemap updated.");
