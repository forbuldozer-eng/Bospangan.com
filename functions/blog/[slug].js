/**
 * Cloudflare Pages dynamic route for /blog/<slug>/.
 * The browser URL remains /blog/<slug>/; the template is fetched only
 * internally from the static asset binding.
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const incoming = new URL(request.url);

  const rawSlug = params.slug;
  const slug = String(Array.isArray(rawSlug) ? rawSlug.join("/") : (rawSlug || ""))
    .replace(/^\/+|\/+$/g, "");

  if (!slug) {
    return env.ASSETS.fetch(new Request(new URL("/blog/index.html", incoming.origin), request));
  }

  const templateUrl = new URL("/article-templates/blog-detail.html", incoming.origin);
  templateUrl.searchParams.set("slug", slug);

  // This is an internal asset fetch. Do not return a redirect or Location header.
  return env.ASSETS.fetch(new Request(templateUrl.toString(), request));
}
