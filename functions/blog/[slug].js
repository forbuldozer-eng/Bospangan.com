import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../auth-config.js";
import { renderArticle } from "../../scripts/render-blog.mjs";

export async function onRequest({ params, request, next }) {
  const slug = params.slug;
  if (!["GET", "HEAD"].includes(request.method) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === "index") {
    return next();
  }
  function page(html, status = 200) {
    return new Response(request.method === "HEAD" ? null : html, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  const endpoint = new URL("/rest/v1/cms_articles", SUPABASE_URL);
  endpoint.search = new URLSearchParams({
    select: "slug,title,excerpt,category,seo_title,seo_description,cover_image_url,cover_image_alt,featured_image_url,featured_image_alt,published_at,updated_at,content_html,content_markdown",
    slug: "eq." + slug,
    content_type: "eq.blog",
    status: "eq.published",
    published_at: "lte." + new Date().toISOString(),
    limit: "1"
  });
  try {
    const result = await fetch(endpoint, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!result.ok) throw new Error("CMS HTTP " + result.status);
    const [article] = await result.json();
    if (article) return page(renderArticle(article));
    return page('<html lang="id"><title>Artikel tidak ditemukan</title><h1>Artikel tidak ditemukan</h1><a href="/blog/">Kembali ke blog</a></html>', 404);
  } catch (error) {
    console.error("Gagal memuat artikel blog", error.message);
    return page('<html lang="id"><title>Artikel belum dapat dimuat</title><h1>Artikel belum dapat dimuat</h1><a href="/blog/">Kembali ke blog</a></html>', 503);
  }
}
