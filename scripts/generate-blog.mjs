import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const config = await readFile(path.join(root, "auth-config.js"), "utf8");
const urlMatch = config.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
const keyMatch = config.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/);
if (!urlMatch || !keyMatch) throw new Error("Konfigurasi Supabase tidak ditemukan di auth-config.js.");

const supabaseUrl = urlMatch[1].replace(/\/$/, "");
const publicKey = keyMatch[1];
const endpoint = new URL(supabaseUrl + "/rest/v1/cms_articles");
endpoint.searchParams.set("select", "title,slug,excerpt,category,seo_title,seo_description,cover_image_url,cover_image_alt,featured_image_url,featured_image_alt,published_at,updated_at,content_markdown,content_html,content_type,status");
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

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function safeUrl(value) {
  const s = String(value || "").trim();
  return /^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s) || /^#/.test(s) ? s : "#";
}
function inlineMarkdown(text) {
  const slots = [];
  const hold = html => {
    const key = "\u0000" + slots.length + "\u0000";
    slots.push(html);
    return key;
  };
  let s = String(text ?? "");
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) =>
    hold('<img src="' + esc(safeUrl(url)) + '" alt="' + esc(alt) + '"' +
      (title ? ' title="' + esc(title) + '"' : '') + ' loading="lazy" decoding="async">'));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
    const href = safeUrl(url);
    const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?bospangan\.com\//i.test(href);
    return hold('<a href="' + esc(href) + '"' + (title ? ' title="' + esc(title) + '"' : '') +
      (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(label) + '</a>');
  });
  s = esc(s);
  s = s.replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[Number(n)] || "");
}
function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    let match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      out.push("<h" + level + ">" + inlineMarkdown(match[2]) + "</h" + level + ">");
      i++; continue;
    }
    if (/^[-*_]{3,}$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(inlineMarkdown(lines[i].trim().replace(/^>\s?/, "")));
        i++;
      }
      out.push("<blockquote><p>" + quote.join("<br>") + "</p></blockquote>");
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        if (!current) {
          let next = i + 1;
          while (next < lines.length && !lines[next].trim()) next++;
          if (next < lines.length && /^[-*]\s+/.test(lines[next].trim())) { i = next; continue; }
          break;
        }
        if (!/^[-*]\s+/.test(current)) break;
        items.push("<li>" + inlineMarkdown(current.replace(/^[-*]\s+/, "")) + "</li>");
        i++;
      }
      out.push("<ul>" + items.join("") + "</ul>");
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        if (!current) {
          let next = i + 1;
          while (next < lines.length && !lines[next].trim()) next++;
          if (next < lines.length && /^\d+\.\s+/.test(lines[next].trim())) { i = next; continue; }
          break;
        }
        if (!/^\d+\.\s+/.test(current)) break;
        items.push("<li>" + inlineMarkdown(current.replace(/^\d+\.\s+/, "")) + "</li>");
        i++;
      }
      out.push("<ol>" + items.join("") + "</ol>");
      continue;
    }
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() &&
      !/^#{1,6}\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim()) &&
      !/^[-*_]{3,}$/.test(lines[i].trim())) {
      paragraph.push(lines[i].trim());
      i++;
    }
    out.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
  }
  return out.join("\n");
}
function safeStoredHtml(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}
function renderArticle(article) {
  const slug = String(article.slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug tidak valid: " + slug);
  const canonical = "https://bospangan.com/blog/" + slug + "/";
  const title = article.title || "Artikel Bos Pangan";
  const description = article.seo_description || article.excerpt || "";
  const image = article.cover_image_url || article.featured_image_url || "";
  const content = article.content_html && article.content_html.trim()
    ? safeStoredHtml(article.content_html)
    : markdownToHtml(article.content_markdown || "");
  if (!content.trim()) throw new Error("Konten kosong: " + slug);
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta"
      })
    : "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    mainEntityOfPage: canonical,
    publisher: { "@type": "Organization", name: "Bos Pangan", url: "https://bospangan.com/" },
    ...(image ? { image: [image] } : {})
  };
  return '<!doctype html>\n<html lang="id">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<title>' + esc(article.seo_title || title) + '</title>\n' +
    '<meta name="description" content="' + esc(description) + '">\n' +
    '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta property="og:type" content="article">\n<meta property="og:site_name" content="Bos Pangan">\n' +
    '<meta property="og:title" content="' + esc(article.seo_title || title) + '">\n' +
    '<meta property="og:description" content="' + esc(description) + '">\n<meta property="og:url" content="' + canonical + '">\n' +
    (image ? '<meta property="og:image" content="' + esc(image) + '">\n' : '') +
    '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, "\\u003c") + '</script>\n' +
    '<style>\n' +
    '*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#fbfcf8;color:#20372a;font:18px/1.8 Georgia,serif}header{background:#0d461a;color:#fff;padding:18px max(4%,calc((100% - 1120px)/2));font:700 14px/1.4 system-ui,sans-serif}header a{color:#fff;text-decoration:none}.wrap{max-width:820px;width:92%;margin:36px auto 72px}.back{display:inline-block;margin-bottom:16px;color:#0d461a;font:600 15px system-ui,sans-serif}.category,.meta{font:13px/1.5 system-ui,sans-serif;color:#68766c}.category{color:#b51d25;font-weight:800;text-transform:uppercase;margin:10px 0}.meta{margin:14px 0 22px}h1{font:700 clamp(34px,6vw,56px)/1.12 Georgia,serif;letter-spacing:-.025em;margin:10px 0 18px}.excerpt{font:18px/1.65 system-ui,sans-serif;color:#52675a;border-left:4px solid #cf1b1d;padding-left:16px;margin:20px 0 26px}.cover{display:block;width:100%;max-height:470px;object-fit:cover;border-radius:14px;margin:24px 0}.content{overflow-wrap:anywhere}.content p{margin:0 0 1.25em}.content h2{font:700 clamp(25px,4vw,34px)/1.2 Georgia,serif;margin:1.7em 0 .65em}.content h3{font:700 clamp(21px,3vw,27px)/1.25 Georgia,serif;margin:1.5em 0 .6em}.content ul,.content ol{padding-left:1.5em;margin:0 0 1.3em}.content li{margin:.35em 0}.content img{display:block;max-width:100%;height:auto;border-radius:12px;margin:20px auto}.content a{color:#0d6a3a;text-decoration:underline;text-underline-offset:3px}.content blockquote{margin:1.4em 0;padding:12px 18px;border-left:4px solid #cf1b1d;background:#f2f5ee}.content code{background:#eef1eb;border-radius:4px;padding:2px 5px;font:.9em ui-monospace,monospace}.related{margin-top:44px;padding-top:22px;border-top:1px solid #dce5dc}.related a{color:#0d461a}.related .brand{font:700 14px system-ui,sans-serif}@media(max-width:600px){body{font-size:17px}.wrap{margin-top:25px}header{padding:16px 4%}}\n' +
    '</style>\n</head>\n<body>\n<header><a href="/">BOS PANGAN · JUARA PANGAN LOKAL</a></header>\n<main class="wrap">\n<a class="back" href="/blog/">← Semua Artikel</a>\n<article>\n<div class="category">' + esc(article.category || "Blog") + '</div>\n<h1>' + esc(title) + '</h1>\n<div class="meta">Bos Pangan · ' + esc(date) + '</div>\n' +
    (image ? '<img class="cover" src="' + esc(image) + '" alt="' + esc(article.cover_image_alt || article.featured_image_alt || title) + '" fetchpriority="high">\n' : '') +
    (article.excerpt ? '<p class="excerpt">' + esc(article.excerpt) + '</p>\n' : '') +
    '<div class="content">\n' + content + '\n</div>\n</article>\n' +
    '<nav class="related" aria-label="Navigasi artikel"><a href="/blog/">← Kembali ke daftar Blog</a><p class="brand">BOS PANGAN · JUARA PANGAN LOKAL</p></nav>\n' +
    '</main>\n</body>\n</html>\n<!-- GENERATED_BY_BOS_PANGAN_BLOG_BUILD -->\n';
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
console.log("Static Blog build completed: " + articles.length + " articles.");
