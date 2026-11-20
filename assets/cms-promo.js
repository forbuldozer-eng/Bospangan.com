import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "https://esm.sh/marked@15.0.7";
import DOMPurify from "https://esm.sh/dompurify@3.2.6";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const listing = document.getElementById("cmsBlogListing");
const detail = document.getElementById("cmsBlogArticle");
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const dateLabel = value => value
  ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  : "Artikel Bos Pangan";

const readingTime = value => Math.max(1, Math.ceil(String(value || "").trim().split(/\s+/).length / 200));

function safeMarkdown(markdown) {
  const html = marked.parse(markdown || "", { breaks: false, gfm: true });
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id"],
  });
  const template = document.createElement("template");
  template.innerHTML = sanitized;
  template.content.querySelectorAll("p").forEach(paragraph => {
    const images = [...paragraph.querySelectorAll(":scope > img")];
    const onlyImages = [...paragraph.childNodes].every(node =>
      (node.nodeType === Node.ELEMENT_NODE && node.tagName === "IMG") ||
      (node.nodeType === Node.TEXT_NODE && !node.textContent.trim())
    );
    if (images.length < 2 || !onlyImages) return;
    const gallery = document.createElement("div");
    gallery.className = "article-gallery";
    images.forEach(image => gallery.append(image));
    paragraph.replaceWith(gallery);
  });
  return template.innerHTML;
}

function ensureGalleryStyles() {
  if (document.getElementById("bosPanganArticleGalleryStyles")) return;
  const style = document.createElement("style");
  style.id = "bosPanganArticleGalleryStyles";
  style.textContent = ".article-content .article-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:22px 0}.article-content .article-gallery img{display:block;width:100%;height:260px;object-fit:cover;border-radius:12px}.article-content .article-gallery img:only-child{grid-column:1/-1}@media(max-width:640px){.article-content .article-gallery{grid-template-columns:1fr}.article-content .article-gallery img{height:auto;max-height:360px}}";
  document.head.append(style);
}

function setMeta(article) {
  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || "";
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.append(meta);
  }
  meta.content = description;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = title;
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = description;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = "https://bospangan.com/promo-fnb/" + encodeURIComponent(article.slug) + "/";
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && article.featured_image_url) ogImage.content = article.featured_image_url;
}

async function getPublishedArticles() {
  let query = supabase
    .from("cms_articles")
    .select("id,title,slug,excerpt,category,content_markdown,featured_image_url,featured_image_alt,seo_title,seo_description,published_at,created_at,updated_at")
    .eq("status", "published")
    .in("category", ["promo", "promo_fnb"]);
  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

function renderListing(articles) {
  if (!listing) return;
  const intro = "Temukan informasi promo dan penawaran produk Bos Pangan untuk kebutuhan usaha makanan dan minuman.";
  listing.innerHTML = '<h1>Promo F&amp;B Bos Pangan</h1>' +
    '<p class="intro">' + esc(intro) + '</p>' +
    (articles.length
      ? articles.map(article => '<article class="item">' +
          '<p class="meta">' + "Promo F&amp;B" + ' · ' + readingTime(article.content_markdown) + ' menit baca · ' + esc(dateLabel(article.published_at || article.created_at)) + '</p>' +
           (article.featured_image_url ? '<a class="blog-card-image" href="/promo-fnb/' + esc(article.slug) + '/"><img loading="lazy" src="' + esc(article.featured_image_url) + '" alt="' + esc(article.featured_image_alt || article.title) + '" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px"></a>' : '') +
          '<h2><a href="/promo-fnb/' + esc(article.slug) + '/">' + esc(article.title) + '</a></h2>' +
          '<p>' + esc(article.excerpt || "") + '</p></article>').join("")
      : '<p>Belum ada artikel yang diterbitkan. Silakan kembali lagi nanti.</p>') +
    '<p><a href="/">Kembali ke halaman utama Bos Pangan</a></p>';
}

function renderDetail(article, allArticles) {
  if (!detail) return;
  const fallbackHero = detail.querySelector(".heroimg")?.outerHTML || "";
  setMeta(article);
  const related = allArticles.filter(item => item.slug !== article.slug).slice(0, 3);
  detail.innerHTML =
    '<div class="crumb"><a href="/">Beranda</a> / <a href="/promo-fnb/">Promo F&amp;B</a> / ' + esc(article.title) + '</div>' +
    '<article><p class="meta">Promo F&B · Diperbarui ' + esc(dateLabel(article.updated_at || article.published_at)) + '</p>' +
    '<h1>' + esc(article.title) + '</h1>' +
    '<p class="lead">' + esc(article.excerpt || "") + '</p>' +
    (article.featured_image_url ? '<img class="heroimg" src="' + esc(article.featured_image_url) + '" alt="' + esc(article.featured_image_alt || article.title) + '" loading="eager">' : fallbackHero) +
    '<div class="article-content">' + safeMarkdown(article.content_markdown) + '</div>' +
    '<div class="callout"><b>Temukan penawaran Bos Pangan lainnya</b><p>Lihat pilihan produk dan informasi terbaru melalui halaman utama Bos Pangan.</p><a class="btn" href="/">Kunjungi Bos Pangan</a></div></article>' +
    (related.length ? '<section class="related"><h2>Artikel terkait</h2><ul>' +
      related.map(item => '<li><a href="/promo-fnb/' + esc(item.slug) + '/">' + esc(item.title) + '</a></li>').join("") +
      '</ul><p><a href="/promo-fnb/">Lihat semua Promo F&amp;B</a></p></section>' : '<p><a href="/promo-fnb/">Lihat semua Promo F&amp;B</a></p>');
}

async function init() {
  ensureGalleryStyles();
  try {
    const articles = await getPublishedArticles();
    if (listing && articles.length) renderListing(articles);
    if (detail) {
      // Resolve the CMS slug from the rewrite query first, then from the URL path.
      // Avoid regex literals here so the browser can parse this module reliably.
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const pathSlug = pathParts[0] === "promo-fnb" ? (pathParts[1] || "") : "";
      const querySlug = new URLSearchParams(window.location.search).get("slug") || "";
      const slug = detail.dataset.slug || querySlug || pathSlug;
      const article = articles.find(item => item.slug === slug);
      if (article) {
        renderDetail(article, articles);
      } else {
        detail.innerHTML = '<div class="article-not-found"><h1>Promo tidak ditemukan</h1><p>Promo mungkin belum diterbitkan atau alamatnya sudah berubah.</p><a href="/promo-fnb/">Kembali ke Promo F&amp;B</a></div>';
      }
    }
  } catch (error) {
    console.error("Bos Pangan Promo F&B failed to load.", error);
    if (detail) {
      detail.innerHTML = '<div class="article-not-found"><h1>Promo belum dapat dimuat</h1><p>Terjadi kendala saat mengambil artikel dari server. Silakan muat ulang halaman beberapa saat lagi.</p><a href="/promo-fnb/">Kembali ke Promo F&amp;B</a></div>';
    }
    if (listing) {
      listing.innerHTML = '<h1>Promo F&amp;B Bos Pangan</h1><p>Promo belum dapat dimuat. Silakan muat ulang halaman beberapa saat lagi.</p>';
    }
  }
}

init();
