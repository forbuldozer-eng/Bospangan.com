/**
 * Keep the public URL under /blog/ while serving the shared article template
 * internally through the Pages ASSETS binding.
 *
 * /blog and /blog/              -> /blog/index.html
 * /blog/<slug>/                 -> /article-templates/blog-detail.html
 *
 * The incoming URL is never redirected to the template path.
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const incoming = new URL(request.url);

  const raw = params.slug;
  const segments = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const slug = segments
    .map((part) => {
      try { return decodeURIComponent(String(part)); }
      catch (_) { return String(part); }
    })
    .filter(Boolean)
    .join("/")
    .replace(/^\/+|\/+$/g, "");

  const assetUrl = new URL(slug ? "/article-templates/blog-detail" : "/blog/", incoming.origin);

  if (slug) {
    assetUrl.searchParams.set("slug", slug);
  }

  const assetRequest = new Request(assetUrl.toString(), request);
  const response = await env.ASSETS.fetch(assetRequest);

  // Keep the public route canonical for crawlers and browser reloads.
  const headers = new Headers(response.headers);
  if (slug) {
    headers.set("Content-Location", incoming.pathname + incoming.search);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
