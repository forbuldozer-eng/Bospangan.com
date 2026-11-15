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
  f.seo_title.value = article.seo_title || "";
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
    .select("id,title,slug,excerpt,content_markdown,featured_image_url,seo_title,seo_description,status,published_at,created_at,updated_at")
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
    seo_description: f.seo_description.value.trim(),
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
