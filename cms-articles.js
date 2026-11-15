import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const slugify = value => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 180);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function markdownPreview(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let listType = null;
  const closeList = () => { if (listType) { html.push(listType === "ol" ? "</ol>" : "</ul>"); listType = null; } };
  const inline = value => {
    let out = escapeHtml(value);
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      const safeHref = href.trim();
      return /^(https?:\/\/|\/)/i.test(safeHref)
        ? '<a href="' + escapeHtml(safeHref) + '" target="_blank" rel="noopener">' + label + "</a>"
        : label;
    });
    return out;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (heading) { closeList(); const level=heading[1].length; html.push("<h"+level+">"+inline(heading[2])+"</h"+level+">"); }
    else if (/^---+$/.test(line)) { closeList(); html.push("<hr>"); }
    else if (line.startsWith(">")) { closeList(); html.push("<blockquote>"+inline(line.replace(/^>\s?/, ""))+"</blockquote>"); }
    else if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (listType !== type) { closeList(); html.push("<"+type+">"); listType=type; }
      html.push("<li>"+inline((bullet || numbered)[1])+"</li>");
    } else { closeList(); html.push("<p>"+inline(line)+"</p>"); }
  }
  closeList();
  return html.join("");
}

function insertMarkdown(command) {
  const field = $("articleContent");
  if (!field) return;
  const templates = {
    h2:"## Judul Bagian", h3:"### Subjudul", bold:"**teks tebal**",
    italic:"*teks miring*", ul:"- Item daftar", ol:"1. Item daftar",
    quote:"> Kutipan", link:"[teks tautan](https://contoh.com)",
    image:"![deskripsi gambar](https://alamat-gambar)", table:"| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Isi 1 | Isi 2 |",
    hr:"\n---\n"
  };
  const value=templates[command] || "";
  const start=field.selectionStart, end=field.selectionEnd;
  field.setRangeText(value,start,end,"end");
  field.focus();
  field.dispatchEvent(new Event("input",{bubbles:true}));
}

function plainArticleText(markdown) {
  return String(markdown || "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[>*_\x60|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text, phrase) {
  const haystack=String(text || "").toLocaleLowerCase("id-ID");
  const needle=String(phrase || "").toLocaleLowerCase("id-ID").trim();
  if (!needle) return 0;
  let count=0, index=0;
  while ((index=haystack.indexOf(needle,index)) !== -1) {
    count++;
    index += needle.length;
  }
  return count;
}

function seoCheck(label, state, detail) {
  return '<li class="'+state+'"><span><strong>'+escapeHtml(label)+'</strong><br>'+escapeHtml(detail)+'</span></li>';
}

function setSeoScore(prefix, score, summary) {
  const wrap=$(prefix==="seo" ? "seoScoreValue" : "readabilityScoreValue");
  const bar=$(prefix==="seo" ? "seoScoreBar" : "readabilityScoreBar");
  const box=bar?.closest(".seo-score-wrap");
  if (wrap) wrap.textContent=score+"/100";
  if (bar) bar.style.width=score+"%";
  if (box) box.dataset.level=score>=75?"good":score>=50?"warning":"bad";
  const note=$(prefix==="seo" ? "seoScoreSummary" : "readabilitySummary");
  if (note) note.textContent=summary;
}

function syncArticleMeta() {
  const form=$("articleForm");
  if (!form) return;
  const f=form.elements;
  const title=f.title.value.trim();
  const excerpt=f.excerpt.value.trim();
  const seoTitle=f.seo_title.value.trim() || title || "Judul artikel akan tampil di sini";
  const seoDescription=f.seo_description.value.trim() || excerpt || "Deskripsi artikel akan tampil di sini.";
  const content=f.content_markdown.value;
  const keyphrase=(f.focus_keyphrase?.value || "").trim();
  const words=content.trim() ? content.trim().split(/\s+/).length : 0;
  const text=plainArticleText(content);
  const lower=text.toLocaleLowerCase("id-ID");
  const phraseCount=countMatches(text,keyphrase);
  const density=words ? phraseCount/words*100 : 0;
  const headings=[...content.matchAll(/^\s{0,3}(#{1,3})\s+(.+)$/gm)];
  const firstParagraph=(content.split(/\n\s*\n/).find(x=>x.trim() && !/^\s{0,3}#/.test(x)) || "");
  const titleLength=seoTitle.length, descLength=f.seo_description.value.trim().length;
  const internalLinks=(content.match(/\]\((?:\/|https?:\/\/bospangan\.com)/gi)||[]).length;
  const externalLinks=(content.match(/\]\(https?:\/\//gi)||[]).length-internalLinks;
  const imageMatches=[...content.matchAll(/!\[([^\]]*)\]\([^)]+\)/g)];
  const sentences=text.split(/[.!?]+/).map(x=>x.trim()).filter(Boolean);
  const avgSentence=sentences.length ? text.split(/\s+/).length/sentences.length : 0;
  const paragraphs=content.split(/\n\s*\n/).map(p=>plainArticleText(p)).filter(Boolean);
  const longParagraphs=paragraphs.filter(p=>p.split(/\s+/).length>120).length;
  const transitions=["namun","selain itu","oleh karena itu","karena itu","dengan demikian","misalnya","sebagai contoh","selanjutnya","pertama","berikutnya","akhirnya","meskipun","sementara itu","di sisi lain","sehingga","akibatnya"];
  const transitionCount=transitions.reduce((sum,w)=>sum+(lower.match(new RegExp("\\b"+w+"\\b","g"))||[]).length,0);
  const checks=[];
  let score=0;
  const add=(label,ok,detail,points=10)=>{score+=ok?points:0;checks.push(seoCheck(label,ok?"good":"warn",detail));};
  add("Frasa kunci utama",!!keyphrase, keyphrase?"Frasa kunci sudah ditentukan.":"Tambahkan frasa kunci utama untuk menganalisis relevansi.");
  add("Frasa kunci di judul",!!keyphrase && countMatches(title,keyphrase)>0,keyphrase?"Pastikan frasa kunci muncul secara alami di judul.":"Belum ada frasa kunci.");
  add("Frasa kunci di URL",!!keyphrase && countMatches(f.slug.value,keyphrase)>0,keyphrase?"Gunakan frasa kunci di slug bila tetap terbaca alami.":"Belum ada frasa kunci.");
  add("Frasa kunci di pembuka",!!keyphrase && countMatches(firstParagraph,keyphrase)>0,keyphrase?"Sebaiknya frasa utama muncul di paragraf pembuka.":"Belum ada frasa kunci.");
  add("Frasa kunci dalam isi",!!keyphrase && phraseCount>=2,keyphrase?(phraseCount+" kemunculan terdeteksi; gunakan secara alami, jangan dipaksakan."):"Belum ada frasa kunci.");
  add("SEO Title",titleLength>=30 && titleLength<=60,"Panjang saat ini "+titleLength+" karakter; target panduan 30–60 karakter.");
  add("Meta Description",descLength>=120 && descLength<=160,"Panjang saat ini "+descLength+" karakter; target panduan 120–160 karakter.");
  add("Panjang artikel",words>=300,"Jumlah saat ini "+words+" kata; artikel informatif umumnya membutuhkan konteks yang cukup.");
  add("Subheading",headings.length>=2,"Ditemukan "+headings.length+" heading Markdown; gunakan beberapa subheading untuk membagi topik.");
  add("Tautan internal",internalLinks>=2,"Ditemukan "+internalLinks+" tautan internal; hubungkan artikel dengan halaman relevan Bos Pangan.");
  add("Gambar dengan alt text",imageMatches.length>0 && imageMatches.every(m=>m[1].trim().length>0),"Ditemukan "+imageMatches.length+" gambar; isi teks alternatif deskriptif pada setiap gambar.");
  add("Frasa kunci pada SEO title",!!keyphrase && countMatches(seoTitle,keyphrase)>0,keyphrase?"Masukkan frasa utama ke SEO Title bila sesuai.":"Belum ada frasa kunci.");
  $("seoChecks").innerHTML=checks.join("");
  setSeoScore("seo",score,score>=80?"Optimasi dasar sudah kuat. Periksa kembali kualitas dan akurasi konten.":score>=55?"Masih ada beberapa rekomendasi SEO yang perlu ditindaklanjuti.":"Lengkapi frasa kunci dan elemen dasar SEO.");
  const readability=[];
  let readScore=100;
  const addRead=(label,ok,detail,penalty)=>{if(!ok)readScore-=penalty;readability.push(seoCheck(label,ok?"good":"warn",detail));};
  addRead("Panjang kalimat",avgSentence>0 && avgSentence<=20,"Rata-rata "+(avgSentence?avgSentence.toFixed(1):"0")+" kata per kalimat; usahakan sekitar 20 kata atau kurang.",18);
  addRead("Panjang paragraf",paragraphs.length>0 && longParagraphs===0,longParagraphs?"Ada "+longParagraphs+" paragraf lebih dari 120 kata.":"Panjang paragraf terdeteksi cukup ringkas.",18);
  addRead("Kata transisi",transitionCount>=Math.max(2,Math.round(sentences.length*0.08)),transitionCount+" penggunaan kata/frasa transisi terdeteksi.",14);
  addRead("Struktur subheading",headings.length>=2,"Ditemukan "+headings.length+" subheading untuk membantu pemindaian konten.",18);
  addRead("Kalimat dan paragraf",sentences.length>=4 && paragraphs.length>=3,"Ditemukan "+sentences.length+" kalimat dan "+paragraphs.length+" blok paragraf.",16);
  readScore=Math.max(0,Math.min(100,readScore));
  $("readabilityChecks").innerHTML=readability.join("");
  setSeoScore("readability",readScore,readScore>=80?"Struktur tulisan cukup mudah dipindai.":readScore>=60?"Perbaiki beberapa bagian agar lebih nyaman dibaca.":"Pecah paragraf dan sederhanakan kalimat.");
  $("articleWordCount").textContent=words+" kata · "+content.length+" karakter";
  $("seoPreviewTitle").textContent=seoTitle;
  $("seoPreviewDescription").textContent=seoDescription;
  $("seoTitleMeter").style.width=Math.min(100,(titleLength/60)*100)+"%";
  $("seoDescriptionMeter").style.width=Math.min(100,(descLength/155)*100)+"%";
  $("seoTitleLength").textContent=titleLength+" karakter";
  $("seoDescriptionLength").textContent=descLength+" karakter";
}


let initialized = false;
let currentUser = null;
let editingArticle = null;

function setStatus(message, isError = false) {
  const node = $("articleStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#a12626" : "";
  node.style.background = isError ? "#fff0f0" : "";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}

function showEditor(show = true) {
  $("articleEditor").classList.toggle("hidden", !show);
  if (show) $("articleEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEditor() {
  editingArticle = null;
  $("articleForm").reset();
  $("articleForm").elements.id.value = "";
  $("articleForm").elements.slug.dataset.manual = "false";
  $("articleImagePreview").textContent = "Belum ada gambar utama.";
  $("articleForm").querySelector('button[type="submit"]').textContent = "Simpan Artikel";
  showEditor(false);
}

function showImage(url) {
  const root = $("articleImagePreview");
  root.replaceChildren();
  if (!url) {
    root.textContent = "Belum ada gambar utama.";
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = "Pratinjau gambar utama artikel";
  image.loading = "lazy";
  image.style.cssText = "display:block;width:min(260px,100%);max-height:180px;object-fit:cover;border-radius:8px;margin:8px 0";
  image.onerror = () => { root.textContent = "Gambar tidak dapat dimuat."; };
  root.append(image);
}

async function uploadFeaturedImage(file) {
  if (!file) return editingArticle?.featured_image_url || null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Gambar harus berformat JPG, PNG, atau WebP.");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 8 MB.");
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  const path = currentUser.id + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await db.storage.from("cms-article-images").upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  const { data } = db.storage.from("cms-article-images").getPublicUrl(path);
  return data.publicUrl;
}

function editArticle(article) {
  editingArticle = article;
  const form = $("articleForm");
  const f = form.elements;
  f.id.value = article.id;
  f.title.value = article.title || "";
  f.slug.value = article.slug || "";
  f.slug.dataset.manual = "true";
  f.excerpt.value = article.excerpt || "";
  f.content_markdown.value = article.content_markdown || "";
  f.seo_title.value = article.seo_title || "";\n  f.focus_keyphrase.value = article.focus_keyphrase || "";
  f.seo_description.value = article.seo_description || "";
  f.status.value = article.status || "draft";
  f.featured_image.value = "";
  showImage(article.featured_image_url);
  form.querySelector('button[type="submit"]').textContent = "Perbarui Artikel";
  showEditor(true);
}

async function loadArticles() {
  setStatus("Memuat daftar artikel...");
  const { data, error } = await db.from("cms_articles")
    .select("id,title,slug,excerpt,content_markdown,featured_image_url,seo_title,seo_description,focus_keyphrase,status,published_at,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const target = $("articlesTable");
  if (!data?.length) {
    target.innerHTML = '<p class="muted">Belum ada artikel. Klik “Artikel Baru” untuk membuat artikel pertama.</p>';
    setStatus("Belum ada artikel.");
    return;
  }

  target.innerHTML = '<table><thead><tr><th>Artikel</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody>' +
    data.map(article => '<tr>' +
      '<td><strong>' + esc(article.title) + '</strong><br><small>/' + esc(article.slug) + '</small></td>' +
      '<td>' + (article.status === "published" ? '<span style="color:#16834d;font-weight:700">Terbit</span>' : '<span style="color:#9a6a12;font-weight:700">Draft</span>') + '</td>' +
      '<td>' + esc(formatDate(article.updated_at)) + '</td>' +
      '<td><button class="btn" type="button" data-edit-article="' + esc(article.id) + '">Edit</button> ' +
      '<button class="btn" type="button" data-delete-article="' + esc(article.id) + '">Hapus</button></td>' +
    '</tr>').join("") + '</tbody></table>';

  target.querySelectorAll("[data-edit-article]").forEach(button => {
    button.addEventListener("click", () => editArticle(data.find(x => x.id === button.dataset.editArticle)));
  });
  target.querySelectorAll("[data-delete-article]").forEach(button => {
    button.addEventListener("click", async () => {
      const article = data.find(x => x.id === button.dataset.deleteArticle);
      if (!article || !confirm('Hapus artikel "' + article.title + '"? Tindakan ini tidak dapat dibatalkan.')) return;
      button.disabled = true;
      const { error: deleteError } = await db.from("cms_articles").delete().eq("id", article.id);
      if (deleteError) {
        setStatus("Gagal menghapus artikel: " + deleteError.message, true);
        button.disabled = false;
        return;
      }
      if (article.featured_image_url) {
        const prefix = new URL(SUPABASE_URL).origin + "/storage/v1/object/public/cms-article-images/";
        if (article.featured_image_url.startsWith(prefix)) {
          const path = decodeURIComponent(article.featured_image_url.slice(prefix.length));
          await db.storage.from("cms-article-images").remove([path]);
        }
      }
      if (editingArticle?.id === article.id) resetEditor();
      setStatus("Artikel berhasil dihapus.");
      await loadArticles();
    });
  });
  setStatus(data.length + " artikel berhasil dimuat.");
}

async function saveArticle(forceDraft = false) {
  const form = $("articleForm");
  const f = form.elements;
  const title = f.title.value.trim();
  const slug = slugify(f.slug.value);
  const content = f.content_markdown.value.trim();
  if (!title || !slug || !content) throw new Error("Judul, slug, dan isi artikel wajib diisi.");
  if (slug !== f.slug.value.trim()) throw new Error("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");

  const status = forceDraft ? "draft" : f.status.value;
  const imageFile = f.featured_image.files?.[0] || null;
  const imageUrl = await uploadFeaturedImage(imageFile);
  const now = new Date().toISOString();
  const wasPublished = editingArticle?.status === "published";
  const payload = {
    title,
    slug,
    excerpt: f.excerpt.value.trim(),
    content_markdown: content,
    featured_image_url: imageUrl,
    seo_title: f.seo_title.value.trim(),
    seo_description: f.seo_description.value.trim(),\n    focus_keyphrase: f.focus_keyphrase.value.trim(),
    status,
    published_at: status === "published" ? (editingArticle?.published_at || now) : null,
    updated_by: currentUser.id,
    updated_at: now
  };

  if (editingArticle) {
    const { error } = await db.from("cms_articles").update(payload).eq("id", editingArticle.id);
    if (error) throw error;
    if (imageFile && editingArticle.featured_image_url && editingArticle.featured_image_url !== imageUrl) {
      const prefix = new URL(SUPABASE_URL).origin + "/storage/v1/object/public/cms-article-images/";
      if (editingArticle.featured_image_url.startsWith(prefix)) {
        const oldPath = decodeURIComponent(editingArticle.featured_image_url.slice(prefix.length));
        await db.storage.from("cms-article-images").remove([oldPath]);
      }
    }
  } else {
    payload.created_by = currentUser.id;
    const { error } = await db.from("cms_articles").insert(payload);
    if (error) throw error;
  }

  resetEditor();
  setStatus(status === "published" ? "Artikel berhasil diterbitkan." : "Artikel berhasil disimpan sebagai draft.");
  await loadArticles();
}

async function initialize() {
  if (initialized) return;
  initialized = true;
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError || !session) {
    setStatus("Sesi login tidak ditemukan. Silakan login kembali.", true);
    return;
  }
  currentUser = session.user;
  const { data: profile, error } = await db.from("profiles")
    .select("role").eq("id", currentUser.id).single();
  if (error || !["admin", "super_admin"].includes(profile?.role)) {
    setStatus("Akses ditolak. Modul artikel hanya untuk Admin dan Super Admin.", true);
    return;
  }

  $("newArticleButton").addEventListener("click", () => {
    resetEditor();
    showEditor(true);
    $("articleForm").elements.title.focus();
  });
  $("cancelArticleEdit").addEventListener("click", resetEditor);
  $("refreshArticles").addEventListener("click", () => loadArticles().catch(error => setStatus(error.message, true)));
  $("articleForm").elements.title.addEventListener("input", event => {
    const slug = $("articleForm").elements.slug;
    if (slug.dataset.manual !== "true") slug.value = slugify(event.target.value);
  });
  $("articleForm").elements.slug.addEventListener("input", event => {
    event.target.dataset.manual = "true";
  });
  $("articleForm").elements.featured_image.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return showImage(editingArticle?.featured_image_url);
    showImage(URL.createObjectURL(file));
  });
  $("cancelArticleEditSide").addEventListener("click", resetEditor);
  $("backToArticleList").addEventListener("click", () => {
    resetEditor();
    $("articleListPanel").scrollIntoView({behavior:"smooth",block:"start"});
  });
  document.querySelectorAll("[data-md]").forEach(button => {
    button.addEventListener("click", () => insertMarkdown(button.dataset.md));
  });
  const contentField=$("articleContent");
  const preview=$("articleContentPreview");
  $("articleVisualTab").addEventListener("click", () => {
    contentField.classList.remove("hidden");
    preview.classList.add("hidden");
  });
  $("articlePreviewTab").addEventListener("click", () => {
    preview.innerHTML=markdownPreview(contentField.value);
    contentField.classList.add("hidden");
    preview.classList.remove("hidden");
  });
  ["title","excerpt","content_markdown","seo_title","seo_description","focus_keyphrase","slug"].forEach(name => {
    $( "articleForm" ).elements[name].addEventListener("input", syncArticleMeta);
  });
  syncArticleMeta();

  $("saveArticleDraft").addEventListener("click", async () => {
    const button = $("saveArticleDraft");
    button.disabled = true;
    try { await saveArticle(true); }
    catch (error) { setStatus("Gagal menyimpan draft: " + (error.message || error), true); }
    finally { button.disabled = false; }
  });
  $("articleForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await saveArticle(false); }
    catch (error) { setStatus("Gagal menyimpan artikel: " + (error.message || error), true); }
    finally { button.disabled = false; }
  });

  await loadArticles();
}

window.addEventListener("cms:articles-open", () => {
  initialize().catch(error => setStatus("Modul artikel gagal dimuat: " + (error.message || error), true));
});
