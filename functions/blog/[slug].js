// Cloudflare Pages Function: serve the article shell without redirecting
// the visitor away from /blog/{slug}/.
export async function onRequest({ request, params, env }) {
  const slug = String(params.slug || "").trim();

  if (!slug) {
    return env.ASSETS.fetch(request);
  }

  const assetUrl = new URL("/blog/article", request.url);
  assetUrl.searchParams.set("slug", slug);

  const assetRequest = new Request(assetUrl.toString(), {
    method: "GET",
    headers: request.headers,
  });

  return env.ASSETS.fetch(assetRequest);
}
