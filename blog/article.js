import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const root = document.getElementById("article");
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function getSlug() {
  const querySlug = new URLSearchParams(location.search).get("slug");
  if (querySlug) return decodeURIComponent(querySlug);
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "blog") parts.shift();
  if (parts.at(-1) === "index.html") parts.pop();
  return decodeURIComponent(parts.at(-1) || "");
}

async function init() {
  const slug = getSlug();
  if (!slug) throw new Error("Slug artikel tidak ditemukan pada alamat halaman.");

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: article, error } = await db
    .from("cms_articles")
    .select("*")
    .eq("content_type", "blog")
    .eq("status", "published")
    .eq("slug", slug)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!article) {
    root.innerHTML = '<h1>Artikel tidak ditemukan</h1><p>Artikel belum dipublikasikan atau slug tidak cocok.</p><a href="/blog/">Kembali ke Blog</a>';
    return;
  }

  const description = article.seo_description || article.excerpt || "";
  document.title = (article.seo_title || article.title) + " | Blog Bos Pangan";

  const meta = document.createElement("meta");
  meta.name = "description";
  meta.content = description;
  document.head.append(meta);

  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = "https://bospangan.com/blog/" + article.slug + "/";
  document.head.append(canonical);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    mainEntityOfPage: canonical.href,
    publisher: { "@type": "Organization", name: "Bos Pangan", url: "https://bospangan.com/" }
  };
  const jsonLd = document.createElement("script");
  jsonLd.type = "application/ld+json";
  jsonLd.textContent = JSON.stringify(schema);
  document.head.append(jsonLd);

  let content = article.content_html || "";
  if (!content.trim() && article.content_markdown) {
    const [{ marked }, { default: DOMPurify }] = await Promise.all([
      import("https://esm.sh/marked@15.0.7"),
      import("https://esm.sh/dompurify@3.2.6")
    ]);
    content = DOMPurify.sanitize(marked.parse(article.content_markdown));
  }
  const image = article.cover_image_url || article.featured_image_url;
  const imageAlt = article.cover_image_alt || article.featured_image_alt || article.title;
  root.className = "";
  root.innerHTML =
    '<div class="cat">' + esc(article.category) + '</div>' +
    '<h1>' + esc(article.title) + '</h1>' +
    '<div class="meta">Bos Pangan · ' +
    new Date(article.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) +
    '</div>' +
    (image ? '<img class="cover" src="' + esc(image) + '" alt="' + esc(imageAlt) + '">' : '') +
    '<div class="content">' + content + '</div>' +
    '<p><a href="/blog/">← Kembali ke semua artikel</a></p>';
}

init().catch(error => {
  console.error("Gagal memuat artikel Blog:", error);
  root.innerHTML = '<h1>Artikel belum dapat dimuat</h1><p>Terjadi kendala saat mengambil data artikel. Silakan muat ulang halaman atau kembali ke daftar artikel.</p><a href="/blog/">Kembali ke Blog</a>';
});
