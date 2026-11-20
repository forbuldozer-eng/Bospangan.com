import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const DEFAULTS = {
  version: 1, synonyms: "", relatedKeyphrases: "",
  schema: { type: "Article", author: "Bos Pangan", breadcrumb: true },
  social: { ogTitle: "", ogDescription: "", ogImage: "", twitterTitle: "", twitterDescription: "", twitterImage: "" },
  advanced: { canonicalUrl: "", noIndex: false, noFollow: false, cornerstone: false }
};
const STOP_WORDS = new Set(("yang dan di ke dari untuk pada dengan adalah ini itu atau sebagai dalam oleh agar akan dapat bisa lebih paling sangat juga tidak sudah telah jika saat secara karena namun tetapi serta tentang para sebuah seorang beberapa setiap jadi maka bagi terhadap antara hingga sampai setelah sebelum tersebut mereka kita anda").split(" "));
const TRANSITIONS = ["selain itu","namun","tetapi","oleh karena itu","karena itu","dengan demikian","sebagai contoh","misalnya","pertama","kedua","berikutnya","selanjutnya","di sisi lain","akhirnya","kesimpulannya","sebagai hasilnya","meskipun demikian","sementara itu"];
let meta = JSON.parse(JSON.stringify(DEFAULTS));
let linkCache = [];
let linkCacheLoaded = false;
let activeDevice = "mobile";

function defaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }
function mergeMeta(input) {
  const base = defaults();
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  return { ...base, ...input,
    schema: { ...base.schema, ...(input.schema || {}) },
    social: { ...base.social, ...(input.social || {}) },
    advanced: { ...base.advanced, ...(input.advanced || {}) }
  };
}
function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
}
function words(text) { return String(text || "").toLocaleLowerCase("id-ID").match(/[\p{L}\p{N}]+/gu) || []; }
function getText() { return $("blogContent")?.innerText || $("blogContent")?.textContent || ""; }
function context() {
  const f = $("blogForm");
  const title = f?.elements.title?.value?.trim() || "";
  const slug = f?.elements.slug?.value?.trim() || slugify(title);
  return {
    form:f, title, slug,
    seoTitle:f?.elements.seo_title?.value?.trim() || title,
    description:f?.elements.seo_description?.value?.trim() || f?.elements.excerpt?.value?.trim() || "",
    excerpt:f?.elements.excerpt?.value?.trim() || "",
    content:$("blogContent"), text:getText(),
    imageAlt:f?.elements.cover_image_alt?.value?.trim() || "",
    imageUrl:f?.elements.cover_image_url?.value?.trim() || ""
  };
}
function getMeta() {
  try { return mergeMeta(JSON.parse($("blogForm")?.elements.seo_metadata?.value || "{}")); }
  catch { return defaults(); }
}
function saveMeta() {
  const f = $("blogForm");
  if (!f?.elements.seo_metadata || !f?.elements.focus_keyphrase) return;
  meta = {
    ...meta,
    synonyms:$("seoSynonyms")?.value || "",
    relatedKeyphrases:$("seoRelatedPhrases")?.value || "",
    schema:{ type:$("seoSchemaType")?.value || "Article", author:$("seoSchemaAuthor")?.value?.trim() || "Bos Pangan", breadcrumb:$("seoBreadcrumb")?.checked ?? true },
    social:{
      ogTitle:$("seoOgTitle")?.value || "", ogDescription:$("seoOgDescription")?.value || "", ogImage:$("seoOgImage")?.value || "",
      twitterTitle:$("seoTwitterTitle")?.value || "", twitterDescription:$("seoTwitterDescription")?.value || "", twitterImage:$("seoTwitterImage")?.value || ""
    },
    advanced:{
      canonicalUrl:$("seoCanonical")?.value?.trim() || "", noIndex:$("seoNoIndex")?.checked || false,
      noFollow:$("seoNoFollow")?.checked || false, cornerstone:$("seoCornerstone")?.checked || false
    }
  };
  f.elements.focus_keyphrase.value = $("seoFocusKeyphrase")?.value?.trim() || "";
  f.elements.seo_metadata.value = JSON.stringify(meta);
}
function applyMeta(next, focus) {
  meta = mergeMeta(next);
  const set = (id, value) => { if ($(id)) $(id).value = value ?? ""; };
  set("seoFocusKeyphrase", focus || "");
  set("seoSynonyms",meta.synonyms); set("seoRelatedPhrases",meta.relatedKeyphrases);
  set("seoSchemaType",meta.schema.type); set("seoSchemaAuthor",meta.schema.author);
  set("seoOgTitle",meta.social.ogTitle); set("seoOgDescription",meta.social.ogDescription); set("seoOgImage",meta.social.ogImage);
  set("seoTwitterTitle",meta.social.twitterTitle); set("seoTwitterDescription",meta.social.twitterDescription); set("seoTwitterImage",meta.social.twitterImage);
  set("seoCanonical",meta.advanced.canonicalUrl);
  if ($("seoBreadcrumb")) $("seoBreadcrumb").checked = meta.schema.breadcrumb !== false;
  if ($("seoNoIndex")) $("seoNoIndex").checked = !!meta.advanced.noIndex;
  if ($("seoNoFollow")) $("seoNoFollow").checked = !!meta.advanced.noFollow;
  if ($("seoCornerstone")) $("seoCornerstone").checked = !!meta.advanced.cornerstone;
  saveMeta(); updateAll();
}
function installStyles() {
  if ($("blogSeoPluginStyles")) return;
  const style = document.createElement("style");
  style.id = "blogSeoPluginStyles";
  style.textContent = [
    ".bps{--bps-line:#e4e9ef;--bps-muted:#78869b;color:#34415b;margin-top:18px}.bps *{box-sizing:border-box}",
    ".bps-tabs{display:flex;gap:6px;border-bottom:1px solid var(--bps-line);overflow:auto;margin:12px 0 18px}",
    ".bps-tab{border:1px solid transparent;border-bottom:0;background:transparent;padding:10px 14px;color:#69778d;font-weight:750;white-space:nowrap;border-radius:8px 8px 0 0;cursor:pointer}",
    ".bps-tab.active{background:#eff8f3;border-color:#cfe9da;color:#146d4b}.bps-panel{display:none}.bps-panel.active{display:block}",
    ".bps-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:16px}",
    ".bps-box{border:1px solid var(--bps-line);border-radius:10px;padding:16px;background:#fff;margin-bottom:14px}.bps-box h4{font-size:14px;margin:0 0 12px;color:#303b53}",
    ".bps-label{display:block;color:#536078;font-weight:700;font-size:12px;margin:12px 0 6px}",
    ".bps-input,.bps-textarea,.bps-select{display:block;width:100%;border:1px solid #dfe5ed;border-radius:7px;padding:10px 11px;background:#fff;color:#34415b;font:13px/1.5 Inter,system-ui,sans-serif}",
    ".bps-textarea{min-height:76px;resize:vertical}.bps-help{font-size:11px;color:var(--bps-muted);margin:5px 0 0;line-height:1.5}",
    ".bps-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}",
    ".bps-btn{border:1px solid #dce4ec;background:#fff;border-radius:7px;padding:8px 11px;font-size:12px;font-weight:700;color:#43516a;cursor:pointer}.bps-btn:hover{border-color:#9acdb2;color:#146d4b}.bps-btn.primary{background:#eaf7ef;border-color:#cce9d6;color:#146d4b}",
    ".bps-preview-switch{display:flex;gap:5px}.bps-preview{border:1px solid #dfe5ed;border-radius:11px;background:#fff;padding:15px;max-width:100%;font-family:Arial,sans-serif;box-shadow:0 2px 8px #13253b0a}.bps-preview.mobile{max-width:430px}.bps-preview.desktop{max-width:100%}",
    ".bps-preview-site{display:flex;align-items:center;gap:9px;color:#202124;font-size:13px}.bps-favicon{width:26px;height:26px;border-radius:50%;background:#eaf4ec;color:#146d4b;display:grid;place-items:center;font-size:12px;font-weight:800}",
    ".bps-preview-url{font-size:12px;color:#5f6368;margin:2px 0 8px;overflow-wrap:anywhere}.bps-preview-title{font-size:20px;line-height:1.3;color:#1a0dab;margin:0 0 5px;font-weight:400;overflow-wrap:anywhere}.bps-preview-desc{font-size:13px;line-height:1.45;color:#4d5156;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
    ".bps-score{border-radius:10px;padding:12px;background:#f5f8fb;border:1px solid var(--bps-line);display:flex;align-items:center;gap:12px;margin-bottom:14px}.bps-score-number{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#fff;border:4px solid #d5e6db;color:#166b49;font-weight:850;font-size:15px}.bps-score-copy{font-size:12px;color:#718096}.bps-score-copy strong{display:block;color:#34415b;font-size:13px;margin-bottom:2px}",
    ".bps-checks{list-style:none;padding:0;margin:0}.bps-checks li{display:flex;gap:9px;padding:9px 0;border-bottom:1px solid #f0f2f5;font-size:12px;line-height:1.45}.bps-check-icon{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:grid;place-items:center;font-weight:850;font-size:11px}.bps-check-icon.good{background:#e5f5eb;color:#16804f}.bps-check-icon.warn{background:#fff2dd;color:#a15c00}.bps-check-icon.bad{background:#fde9e7;color:#b42318}",
    ".bps-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.bps-metric{border:1px solid var(--bps-line);border-radius:8px;padding:12px;background:#fbfcfd}.bps-metric span{display:block;color:#8190a3;font-size:11px}.bps-metric strong{font-size:21px;color:#34415b}",
    ".bps-note{font-size:11px;color:#78869b;line-height:1.6}.bps-suggestion{border:1px solid #e7edf2;border-radius:8px;padding:10px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px}.bps-suggestion strong{display:block;color:#34415b}.bps-suggestion small{color:#8b98aa}",
    ".bps-preview-social{border:1px solid #e2e7ed;border-radius:10px;overflow:hidden;max-width:540px;margin-top:12px;background:#fff}.bps-preview-social img{width:100%;height:180px;object-fit:cover;display:block;background:#f4f6f8}.bps-preview-social div{padding:12px}.bps-preview-social small{color:#8995a5;font-size:10px;text-transform:uppercase}.bps-preview-social strong{display:block;font-size:14px;margin:4px 0}.bps-preview-social p{margin:0;color:#69778d;font-size:12px}",
    ".bps-details{border:1px solid var(--bps-line);border-radius:9px;margin:12px 0;background:#fff}.bps-details summary{padding:12px 14px;font-size:13px;font-weight:750;cursor:pointer;color:#44526a}.bps-details-body{padding:0 14px 14px}.bps-toggle{display:flex;gap:8px;align-items:center;font-size:12px;font-weight:600;margin:12px 0;color:#536078}.bps-toggle input{width:16px;height:16px;accent-color:#15845a}.bps-pre{white-space:pre-wrap;word-break:break-word;background:#f6f8fa;border:1px solid var(--bps-line);border-radius:8px;padding:12px;font-size:11px;max-height:260px;overflow:auto}",
    "@media(max-width:900px){.bps-grid{grid-template-columns:1fr}.bps-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.bps-box{padding:12px}.bps-tabs{gap:2px}.bps-tab{padding:9px 10px;font-size:12px}.bps-metrics{grid-template-columns:1fr 1fr}}"
  ].join("");
  document.head.appendChild(style);
}
function panelMarkup() {
  return [
    '<div class="bps" id="bpsRoot">',
    '<div class="bps-tabs" role="tablist" aria-label="Panel SEO"><button type="button" class="bps-tab active" data-bps-tab="seo">SEO</button><button type="button" class="bps-tab" data-bps-tab="readability">Keterbacaan</button><button type="button" class="bps-tab" data-bps-tab="schema">Skema</button><button type="button" class="bps-tab" data-bps-tab="social">Sosial</button></div>',
    '<section class="bps-panel active" data-bps-panel="seo"><div class="bps-grid"><div>',
    '<div class="bps-box"><h4>Frasa kunci utama</h4><label class="bps-label" for="seoFocusKeyphrase">Focus keyphrase</label><input class="bps-input" id="seoFocusKeyphrase" placeholder="Contoh: usaha warung sembako"><p class="bps-help">Gunakan frasa utama yang benar-benar menggambarkan topik artikel.</p>',
    '<label class="bps-label" for="seoSynonyms">Sinonim frasa kunci</label><input class="bps-input" id="seoSynonyms" placeholder="Pisahkan sinonim dengan koma"><label class="bps-label" for="seoRelatedPhrases">Frasa kunci terkait</label><textarea class="bps-textarea" id="seoRelatedPhrases" placeholder="Contoh: modal usaha warung, cara mengelola stok"></textarea>',
    '<div class="bps-row" style="margin-top:8px"><button type="button" class="bps-btn" id="seoSuggestPhrases">Saran frasa dari isi artikel</button><span class="bps-help">Saran lokal, bukan data volume pencarian.</span></div><div id="seoPhraseSuggestions"></div></div>',
    '<div class="bps-box"><div class="bps-row"><h4 style="margin:0">Tampilan hasil pencarian Google</h4><div class="bps-preview-switch"><button class="bps-btn primary" type="button" data-bps-device="mobile">Ponsel</button><button class="bps-btn" type="button" data-bps-device="desktop">Desktop</button></div></div>',
    '<div class="bps-preview mobile" id="seoGooglePreview" style="margin-top:12px"><div class="bps-preview-site"><span class="bps-favicon">B</span><span><strong>Bos Pangan</strong><br><span style="color:#777;font-size:11px">https://bospangan.com</span></span></div><div class="bps-preview-url" id="seoPreviewUrl">https://bospangan.com/blog/slug-artikel/</div><h3 class="bps-preview-title" id="seoPreviewTitle">Judul SEO artikel</h3><div class="bps-preview-desc" id="seoPreviewDesc">Meta description akan tampil di sini.</div></div><p class="bps-note" style="margin-top:8px">Preview ini perkiraan; Google dapat memilih cuplikan berbeda dari isi halaman.</p></div>',
    '</div><div><div class="bps-score"><div class="bps-score-number" id="bpsScoreNumber">—</div><div class="bps-score-copy"><strong>Skor pemeriksaan SEO</strong><span id="bpsScoreText">Isi frasa kunci untuk memulai analisis.</span></div></div>',
    '<div class="bps-box"><h4>Analisis SEO</h4><ul class="bps-checks" id="bpsSeoChecks"><li>Analisis akan tampil setelah Anda mengisi artikel.</li></ul></div>',
    '<div class="bps-box"><h4>Saran tautan internal</h4><p class="bps-help">Artikel Blog Bos Pangan yang mungkin relevan untuk ditautkan.</p><div id="bpsInternalSuggestions"><span class="bps-note">Memuat daftar artikel…</span></div><p class="bps-note">Pilih teks pada editor sebelum menekan Sisipkan agar teks terpilih menjadi anchor link.</p></div>',
    '</div></div></section>',
    '<section class="bps-panel" data-bps-panel="readability"><div class="bps-box"><h4>Analisis keterbacaan Bahasa Indonesia</h4><p class="bps-note">Indikator sederhana untuk membantu menyunting naskah. Ini bukan skor resmi Yoast atau jaminan peringkat Google.</p>',
    '<div class="bps-metrics"><div class="bps-metric"><span>Jumlah kata</span><strong id="bpsWordCount">0</strong></div><div class="bps-metric"><span>Estimasi baca</span><strong id="bpsReadTime">0 mnt</strong></div><div class="bps-metric"><span>Rata-rata kata/kalimat</span><strong id="bpsSentenceLength">0</strong></div><div class="bps-metric"><span>Rata-rata kata/paragraf</span><strong id="bpsParagraphLength">0</strong></div><div class="bps-metric"><span>Subjudul H2/H3</span><strong id="bpsHeadingCount">0</strong></div><div class="bps-metric"><span>Tautan internal</span><strong id="bpsInternalCount">0</strong></div></div><ul class="bps-checks" id="bpsReadabilityChecks"></ul></div></section>',
    '<section class="bps-panel" data-bps-panel="schema"><div class="bps-box"><h4>Structured data (Schema.org)</h4><label class="bps-label" for="seoSchemaType">Jenis schema artikel</label><select class="bps-select" id="seoSchemaType"><option value="Article">Article</option><option value="BlogPosting">BlogPosting</option><option value="NewsArticle">NewsArticle</option></select><label class="bps-label" for="seoSchemaAuthor">Nama penulis</label><input class="bps-input" id="seoSchemaAuthor" value="Bos Pangan"><label class="bps-toggle"><input type="checkbox" id="seoBreadcrumb" checked> Sertakan breadcrumb schema</label><p class="bps-note">Schema akan dibuat di HTML saat Cloudflare membangun artikel. FAQ/HowTo tidak dipaksakan jika isi tidak sesuai.</p><h4 style="margin-top:18px">Contoh JSON-LD</h4><pre class="bps-pre" id="bpsSchemaPreview">{}</pre></div></section>',
    '<section class="bps-panel" data-bps-panel="social"><div class="bps-grid"><div class="bps-box"><h4>Facebook / Open Graph</h4><label class="bps-label" for="seoOgTitle">Judul sosial</label><input class="bps-input" id="seoOgTitle" placeholder="Default: SEO title"><label class="bps-label" for="seoOgDescription">Deskripsi sosial</label><textarea class="bps-textarea" id="seoOgDescription" placeholder="Default: meta description"></textarea><label class="bps-label" for="seoOgImage">URL gambar sosial</label><input class="bps-input" id="seoOgImage" placeholder="Default: gambar utama artikel"><div class="bps-box" style="margin-top:14px"><h4>Pratinjau Open Graph</h4><div class="bps-preview-social" id="bpsOgPreview"></div></div></div>',
    '<div class="bps-box"><h4>X (Twitter) Card</h4><label class="bps-label" for="seoTwitterTitle">Judul X</label><input class="bps-input" id="seoTwitterTitle" placeholder="Default: SEO title"><label class="bps-label" for="seoTwitterDescription">Deskripsi X</label><textarea class="bps-textarea" id="seoTwitterDescription" placeholder="Default: meta description"></textarea><label class="bps-label" for="seoTwitterImage">URL gambar X</label><input class="bps-input" id="seoTwitterImage" placeholder="Default: gambar utama artikel"><p class="bps-note">Metadata Open Graph dan Twitter akan ditanamkan ke HTML statis.</p></div></div></section>',
    '<details class="bps-details"><summary>Pengaturan lanjutan</summary><div class="bps-details-body"><label class="bps-label" for="seoCanonical">Canonical URL (opsional)</label><input class="bps-input" id="seoCanonical" placeholder="Kosongkan untuk memakai URL artikel ini"><p class="bps-help">Gunakan hanya jika artikel ini memang memiliki URL utama lain yang sah.</p><label class="bps-toggle"><input type="checkbox" id="seoNoIndex"> Jangan tampilkan halaman ini di hasil pencarian (noindex)</label><label class="bps-toggle"><input type="checkbox" id="seoNoFollow"> Jangan ikuti tautan pada halaman (nofollow)</label><label class="bps-toggle"><input type="checkbox" id="seoCornerstone"> Tandai sebagai konten utama (cornerstone)</label></div></details>',
    '<p class="bps-note">Skor adalah alat bantu editorial on-page. Hasil pencarian juga dipengaruhi banyak faktor lain.</p></div>'
  ].join("");
}
function setTab(name) {
  document.querySelectorAll("[data-bps-tab]").forEach((b) => b.classList.toggle("active",b.dataset.bpsTab===name));
  document.querySelectorAll("[data-bps-panel]").forEach((p) => p.classList.toggle("active",p.dataset.bpsPanel===name));
}
function counter(value,min,max) {
  const n=String(value||"").length;
  return n<min||n>max ? n+" karakter · panduan "+min+"–"+max : n+" karakter · dalam rentang panduan";
}
function row(ok,title,detail,strict=false) {
  const status=ok?"good":(strict?"bad":"warn");
  return '<li><span class="bps-check-icon '+status+'">'+(ok?"✓":(strict?"!":"•"))+'</span><span><strong>'+esc(title)+'</strong><br><span style="color:#8390a1">'+esc(detail)+'</span></span></li>';
}
function updatePreview() {
  const c=context(),m=getMeta(),canonical=m.advanced.canonicalUrl.trim()||("https://bospangan.com/blog/"+c.slug+"/");
  $("seoPreviewTitle").textContent=c.seoTitle||"Judul SEO artikel";
  $("seoPreviewDesc").textContent=c.description||"Tambahkan meta description agar ringkasan artikel dapat dikendalikan.";
  $("seoPreviewUrl").textContent=canonical;
  $("seoGooglePreview").classList.toggle("mobile",activeDevice==="mobile");
  $("seoGooglePreview").classList.toggle("desktop",activeDevice==="desktop");
  document.querySelectorAll("[data-bps-device]").forEach((b)=>b.classList.toggle("primary",b.dataset.bpsDevice===activeDevice));
  const ot=m.social.ogTitle||c.seoTitle,od=m.social.ogDescription||c.description,oi=m.social.ogImage||c.imageUrl;
  $("bpsOgPreview").innerHTML=(oi?'<img src="'+esc(oi)+'" alt="Preview gambar sosial">':"")+'<div><small>bospangan.com</small><strong>'+esc(ot||"Judul artikel")+'</strong><p>'+esc(od||"Deskripsi artikel")+'</p></div>';
}
function updateSchemaPreview() {
  const c=context(),m=getMeta(),url=m.advanced.canonicalUrl.trim()||("https://bospangan.com/blog/"+c.slug+"/");
  const schema={"@context":"https://schema.org","@type":["Article","BlogPosting","NewsArticle"].includes(m.schema.type)?m.schema.type:"Article",headline:c.title,description:c.description||c.excerpt,mainEntityOfPage:url,author:{"@type":"Person",name:m.schema.author||"Bos Pangan"},publisher:{"@type":"Organization",name:"Bos Pangan",url:"https://bospangan.com/"},...(c.imageUrl?{image:[c.imageUrl]}:{})};
  if(m.schema.breadcrumb)schema.breadcrumb={"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Beranda",item:"https://bospangan.com/"},{"@type":"ListItem",position:2,name:"Blog",item:"https://bospangan.com/blog/"},{"@type":"ListItem",position:3,name:c.title,item:url}]};
  $("bpsSchemaPreview").textContent=JSON.stringify(schema,null,2);
}
function runAnalysis() {
  const c=context(),focus=($("seoFocusKeyphrase")?.value||"").trim().toLocaleLowerCase("id-ID"),tokens=words(c.text),body=c.text.toLocaleLowerCase("id-ID");
  const headings=Array.from(c.content?.querySelectorAll("h2,h3")||[]).map(x=>x.innerText.toLocaleLowerCase("id-ID"));
  const intro=tokens.slice(0,Math.max(45,Math.ceil(tokens.length*.12))).join(" ");
  const anchors=Array.from(c.content?.querySelectorAll("a[href]")||[]);
  const internal=anchors.filter(a=>a.getAttribute("href")?.startsWith("/")||/^https?:\/\/(www\.)?bospangan\.com\//i.test(a.href)).length;
  const checks=[];
  if(!focus) checks.push([false,"Frasa kunci utama","Isi focus keyphrase agar pemeriksaan lebih relevan.",true]);
  else {
    checks.push([true,"Frasa kunci utama","Focus keyphrase sudah ditentukan."]);
    checks.push([c.seoTitle.toLocaleLowerCase("id-ID").includes(focus),"Frasa kunci di SEO title","Gunakan frasa utama secara alami pada judul SEO."]);
    checks.push([c.description.toLocaleLowerCase("id-ID").includes(focus),"Frasa kunci di meta description","Masukkan frasa utama ke ringkasan hasil pencarian."]);
    checks.push([c.slug.includes(slugify(focus)),"Frasa kunci di slug","Buat slug singkat dan relevan dengan frasa utama."]);
    checks.push([intro.includes(focus),"Frasa kunci di bagian awal","Sebutkan topik utama secara alami di bagian awal artikel."]);
    checks.push([headings.some(h=>h.includes(focus)),"Frasa kunci di subjudul","Tambahkan frasa utama atau variasinya pada H2/H3."]);
    const phraseWords=words(focus),density=tokens.length&&phraseWords.length?(body.split(focus).length-1)*phraseWords.length/tokens.length*100:0;
    checks.push([density<=2.5,"Pengulangan frasa","Perkiraan kepadatan "+density.toFixed(1)+"%; hindari pengulangan berlebihan."]);
  }
  checks.push([c.seoTitle.length>=30&&c.seoTitle.length<=60,"Panjang SEO title",counter(c.seoTitle,30,60)]);
  checks.push([c.description.length>=110&&c.description.length<=160,"Panjang meta description",counter(c.description,110,160)]);
  checks.push([!c.imageUrl||!!c.imageAlt,"Alt text gambar utama",c.imageUrl?"Jelaskan isi gambar secara spesifik.":"Tambahkan gambar utama bila relevan."]);
  checks.push([tokens.length>=300,"Panjang isi artikel",tokens.length+" kata terdeteksi; 300 kata adalah panduan editorial, bukan syarat ranking."]);
  checks.push([internal>=1,"Tautan internal",internal+" tautan internal ditemukan; tautkan ke halaman yang relevan."]);
  const score=Math.round(checks.filter(x=>x[0]).length/Math.max(1,checks.length)*100);
  $("bpsScoreNumber").textContent=score;$("blogSeoScoreBadge").textContent=score+"/100 SEO";
  $("bpsScoreText").textContent=score>=80?"Dasar SEO on-page cukup lengkap.":score>=55?"Masih ada hal yang dapat diperbaiki.":"Lengkapi elemen utama sebelum menerbitkan.";
  $("bpsSeoChecks").innerHTML=checks.map(x=>row(x[0],x[1],x[2],x[3])).join("");

  const paragraphs=Array.from(c.content?.querySelectorAll("p")||[]).map(p=>words(p.innerText).length).filter(Boolean);
  const sentences=(c.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(s=>words(s).length).filter(Boolean);
  const avgSentence=sentences.length?sentences.reduce((a,b)=>a+b,0)/sentences.length:0;
  const avgParagraph=paragraphs.length?paragraphs.reduce((a,b)=>a+b,0)/paragraphs.length:0;
  const longParagraphs=paragraphs.filter(n=>n>100).length;
  const transitions=TRANSITIONS.filter(t=>body.includes(t)).length;
  $("bpsWordCount").textContent=tokens.length;$("bpsReadTime").textContent=Math.max(1,Math.ceil(tokens.length/200))+" mnt";
  $("bpsSentenceLength").textContent=avgSentence.toFixed(1);$("bpsParagraphLength").textContent=avgParagraph.toFixed(1);
  $("bpsHeadingCount").textContent=headings.length;$("bpsInternalCount").textContent=internal;
  const read=[
    [sentences.length>0&&avgSentence<=25,"Panjang kalimat","Rata-rata "+avgSentence.toFixed(1)+" kata per kalimat. Pecah kalimat yang terlalu panjang."],
    [longParagraphs===0,"Panjang paragraf",longParagraphs+" paragraf berisi lebih dari 100 kata."],
    [transitions>0,"Kata transisi",transitions+" kata transisi terdeteksi. Gunakan penghubung seperti selain itu, namun, dan selanjutnya."],
    [tokens.length<300||headings.length>=Math.ceil(tokens.length/300),"Distribusi subjudul",headings.length+" subjudul untuk "+tokens.length+" kata. Pecah bagian panjang dengan H2/H3."]
  ];
  $("bpsReadabilityChecks").innerHTML=read.map(x=>row(x[0],x[1],x[2])).join("");
  updatePreview();updateSchemaPreview();
}
function updateAll(){if(!$("bpsRoot"))return;runAnalysis();}
function suggestPhrases() {
  const c=context(),freq=new Map(),titleTokens=words(c.title);
  for(const token of words(c.text)){if(token.length<5||STOP_WORDS.has(token))continue;freq.set(token,(freq.get(token)||0)+1);}
  const suggestions=Array.from(freq.entries()).filter(([w])=>!titleTokens.includes(w)).sort((a,b)=>b[1]-a[1]).slice(0,6).map(x=>x[0]);
  $("seoPhraseSuggestions").innerHTML=suggestions.length?suggestions.map(p=>'<div class="bps-suggestion"><span><strong>'+esc(p)+'</strong><small>Sering muncul dalam isi artikel</small></span><button class="bps-btn" type="button" data-add-phrase="'+esc(p)+'">Tambahkan</button></div>').join(""):'<p class="bps-note">Isi artikel terlebih dahulu untuk mendapat saran.</p>';
}
async function loadLinkSuggestions() {
  if(linkCacheLoaded){renderLinkSuggestions();return;}
  linkCacheLoaded=true;
  const {data,error}=await db.from("cms_articles").select("title,slug,excerpt,focus_keyphrase").eq("content_type","blog").eq("status","published").order("published_at",{ascending:false}).limit(50);
  if(error){$("bpsInternalSuggestions").innerHTML='<span class="bps-note">Saran tautan tidak dapat dimuat. Tautan manual tetap dapat ditambahkan.</span>';return;}
  linkCache=data||[];renderLinkSuggestions();
}
function renderLinkSuggestions() {
  const c=context(),focus=($("seoFocusKeyphrase")?.value||"").toLocaleLowerCase("id-ID"),body=c.text.toLocaleLowerCase("id-ID");
  const candidates=linkCache.filter(x=>x.slug!==c.slug).map(x=>{
    const key=(x.focus_keyphrase||x.title||"").toLocaleLowerCase("id-ID"),t=words(key).filter(w=>w.length>3);
    const hits=t.filter(w=>body.includes(w)).length;
    return {...x,relevance:hits+(focus&&(key.includes(focus)||focus.includes(key))?3:0)};
  }).filter(x=>x.relevance>0).sort((a,b)=>b.relevance-a.relevance).slice(0,5);
  if(!c.text.trim()){$("bpsInternalSuggestions").innerHTML='<span class="bps-note">Tulis isi artikel untuk mencari tautan terkait.</span>';return;}
  if(!candidates.length){$("bpsInternalSuggestions").innerHTML='<span class="bps-note">Belum ada artikel lain yang cukup relevan. Tambahkan tautan manual bila sesuai konteks.</span>';return;}
  $("bpsInternalSuggestions").innerHTML=candidates.map(x=>'<div class="bps-suggestion"><span><strong>'+esc(x.title)+'</strong><small>/blog/'+esc(x.slug)+'/</small></span><button class="bps-btn" type="button" data-insert-link="'+esc(x.slug)+'" data-link-title="'+esc(x.title)+'">Sisipkan</button></div>').join("");
}
function insertLink(slug,title) {
  const editor=$("blogContent");editor?.focus();
  const selection=window.getSelection(),selected=selection&&selection.toString().trim();
  const url="/blog/"+slug+"/";
  if(selected&&editor.contains(selection.anchorNode))document.execCommand("createLink",false,url);
  else document.execCommand("insertHTML",false,'<a href="'+esc(url)+'">'+esc(title)+'</a>');
  saveMeta();runAnalysis();renderLinkSuggestions();
}
function addPhrase(phrase) {
  const field=$("seoRelatedPhrases"),items=(field.value||"").split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
  if(!items.some(x=>x.toLowerCase()===phrase.toLowerCase()))items.push(phrase);
  field.value=items.join(", ");saveMeta();runAnalysis();
}
function install(host) {
  if(host.dataset.bpsInstalled==="1")return;
  installStyles();
  const extra=$("blogSeoPluginExtra");if(!extra)return;
  extra.innerHTML=panelMarkup();host.dataset.bpsInstalled="1";
  applyMeta(getMeta(),$("blogForm").elements.focus_keyphrase.value||"");
  extra.addEventListener("click",(event)=>{
    const tab=event.target.closest("[data-bps-tab]");if(tab){setTab(tab.dataset.bpsTab);return;}
    const device=event.target.closest("[data-bps-device]");if(device){activeDevice=device.dataset.bpsDevice;updatePreview();document.querySelectorAll("[data-bps-device]").forEach(b=>b.classList.toggle("primary",b.dataset.bpsDevice===activeDevice));return;}
    if(event.target.closest("#seoSuggestPhrases")){suggestPhrases();return;}
    const phrase=event.target.closest("[data-add-phrase]");if(phrase){addPhrase(phrase.dataset.addPhrase);return;}
    const link=event.target.closest("[data-insert-link]");if(link){insertLink(link.dataset.insertLink,link.dataset.linkTitle);return;}
  });
  $("blogForm").addEventListener("input",(event)=>{
    if(event.target.closest("#bpsRoot")||["title","slug","excerpt","seo_title","seo_description","cover_image_alt","cover_image_url"].includes(event.target.name)||event.target.id==="blogContent"){
      saveMeta();runAnalysis();renderLinkSuggestions();
    }
  });
  $("blogForm").addEventListener("change",(event)=>{if(event.target.closest("#bpsRoot")){saveMeta();runAnalysis();}});
  runAnalysis();loadLinkSuggestions();
}
function findAndInstall(){const host=$("blogSeoPluginHost");if(host&&$("blogSeoPluginExtra"))install(host);}
const observer=new MutationObserver(findAndInstall);
observer.observe(document.documentElement,{childList:true,subtree:true});
findAndInstall();

window.addEventListener("blog:seo-reset",()=>{
  meta=defaults();
  if($("blogSeoPluginHost")?.dataset.bpsInstalled==="1"){
    applyMeta(meta,"");if($("seoFocusKeyphrase"))$("seoFocusKeyphrase").value="";
    runAnalysis();loadLinkSuggestions();
  }
});
window.addEventListener("blog:seo-load",(event)=>{
  meta=mergeMeta(event.detail?.metadata||{});
  if($("blogSeoPluginHost")?.dataset.bpsInstalled==="1"){
    applyMeta(meta,event.detail?.focusKeyphrase||"");loadLinkSuggestions();runAnalysis();
  }
});
