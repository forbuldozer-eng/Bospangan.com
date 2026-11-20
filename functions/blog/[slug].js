export function onRequest({ request, params, env, next }) {
  const slug = params.slug;
  // Pages also matches this route for scripts and the template's clean URL.
  if (slug === "article" || slug === "index" || slug.includes(".")) {
    return next();
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return next();
  }

  // Fetch the clean asset path. Fetching article.html would redirect the browser.
  const template = new URL("/blog/article", request.url);
  return env.ASSETS.fetch(new Request(template, request));
}
