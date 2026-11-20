import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const listing = document.getElementById("cmsBlogListing");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });
}

function renderArticles(articles) {
  if (!listing) return;
  const cards = articles.map(article => {
    const slug = escapeHtml(article.slug);
    const title = escapeHtml(article.title);
    const image = article.featured_image_url
      ? '<a href="/promo-fnb/' + slug + '/"><img loading="lazy" src="' + escapeHtml(article.featured_image_url) +
        '" alt="' + escapeHtml(article.featured_image_alt || article.title) +
        '" style="display:block;width:100%;max-height:340px;object-fit:cover;border-radius:12px;margin:18px 0"></a>'
      : "";
    return '<article class="item">' +
      '<p class="meta">Promo F&amp;B' + (article.published_at ? " · " + escapeHtml(formatDate(article.published_at)) : "") + '</p>' +
      image +
      '<h2><a href="/promo-fnb/' + slug + '/">' + title + '</a></h2>' +
      '<p>' + escapeHtml(article.excerpt || "") + '</p></article>';
  }).join("");

  listing.innerHTML = '<h1>Promo F&amp;B Bos Pangan</h1>' +
    '<p class="intro">Temukan informasi promo dan penawaran terbaru dari Bos Pangan.</p>' +
    (cards || '<p>Belum ada artikel Promo F&amp;B yang berstatus Terbit. Periksa kategori dan status artikel di CMS.</p>') +
    '<p><a href="/">Kembali ke halaman utama Bos Pangan</a></p>';
}

function renderError(error) {
  console.error("Promo F&B listing failed:", error);
  if (!listing) return;
  listing.innerHTML = '<h1>Promo F&amp;B Bos Pangan</h1>' +
    '<p class="intro">Temukan informasi promo dan penawaran terbaru dari Bos Pangan.</p>' +
    '<p role="alert">Promo belum dapat dimuat dari CMS. Silakan muat ulang halaman. Jika kendala berlanjut, periksa koneksi Supabase dan izin baca artikel publik.</p>';
}

async function loadPromoArticles() {
  if (!listing) return;
  try {
    const endpoint = new URL("/rest/v1/cms_articles", SUPABASE_URL);
    endpoint.searchParams.set("select", "id,title,slug,excerpt,featured_image_url,featured_image_alt,published_at,created_at");
    endpoint.searchParams.set("status", "eq.published");
    // Accept the legacy value too, while the CMS now writes the canonical promo_fnb value.
    endpoint.searchParams.set("category", "in.(promo_fnb,promo)");
    endpoint.searchParams.set("order", "published_at.desc.nullslast,created_at.desc");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          Accept: "application/json"
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error("Supabase returned " + response.status + ": " + detail.slice(0, 300));
    }
    const articles = await response.json();
    renderArticles(Array.isArray(articles) ? articles : []);
  } catch (error) {
    renderError(error);
  }
}

loadPromoArticles();
