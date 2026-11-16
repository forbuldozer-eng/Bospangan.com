import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slugify = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180);
const BUCKET = "landing-page-images";
let initialized = false, user = null, role = null, editingId = null, slugTouched = false;

function status(message, error=false) {
  const node = $("landingStatus");
  if (node) { node.textContent = message; node.classList.toggle("error", error); }
}
function panelMarkup() {
  if ($("landingPagesPanel")) return;
  const panel = document.createElement("section");
  panel.id = "landingPagesPanel";
  panel.className = "panel";
  panel.innerHTML = `
    <div class="page-head" style="margin-bottom:18px">
      <div><h1 class="page-title">Landing Page</h1><p class="page-subtitle">Buat dan kelola halaman promosi Bos Pangan. URL publik menggunakan /landingpage/slug.</p></div>
      <div class="head-actions"><button class="btn" id="landingRefresh" type="button">Muat Ulang</button><button class="btn primary" id="landingNew" type="button">+ Landing Page Baru</button></div>
    </div>
    <p class="status" id="landingStatus" role="status" aria-live="polite">Memuat halaman...</p>
    <section id="landingEditor" class="hidden">
      <form id="landingForm">
        <input type="hidden" name="id">
        <div class="article-field">
          <input class="article-title-input" name="title" maxlength="220" required placeholder="Masukkan judul landing page">
          <div class="article-slug-row"><span>Permalink</span><span>/landingpage/</span><input name="slug" maxlength="180" required placeholder="slug-landing-page"><button class="btn" id="landingCopyUrl" type="button">Salin URL</button></div>
        </div>
        <div class="article-card" style="margin-top:16px">
          <label class="article-label" for="landingExcerpt">Ringkasan halaman</label>
          <textarea id="landingExcerpt" name="excerpt" rows="3" maxlength="500" placeholder="Ringkasan singkat untuk pengunjung dan mesin pencari"></textarea>
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin:18px 0 8px">
            <strong>Konten Landing Page</strong><span class="muted">Gunakan toolbar seperti editor artikel</span>
          </div>
          <div class="tabs" id="landingToolbar" style="margin-bottom:8px;flex-wrap:wrap">
            <button type="button" data-cmd="bold"><b>B</b></button><button type="button" data-cmd="italic"><i>I</i></button>
            <button type="button" data-cmd="h2">H2</button><button type="button" data-cmd="h3">H3</button>
            <button type="button" data-cmd="ul">• Daftar</button><button type="button" data-cmd="ol">1. Daftar</button>
            <button type="button" data-cmd="quote">Kutipan</button><button type="button" data-cmd="link">Tautan</button>
          </div>
          <div id="landingContent" contenteditable="true" role="textbox" aria-multiline="true" style="min-height:360px;border:1px solid #dbe2ea;border-radius:10px;padding:18px;background:#fff;line-height:1.75;outline-offset:2px" data-placeholder="Mulai tulis konten landing page..."></div>
          <p class="muted" style="font-size:12px">Konten mendukung heading, paragraf, daftar, tautan, dan format dasar. Hindari menempelkan script atau kode aktif.</p>
        </div>
        <div class="article-card" style="margin-top:16px">
          <h3 style="margin-top:0">Gambar Utama</h3>
          <label>Upload gambar (JPG, PNG, WebP; maksimal 8 MB)<input type="file" id="landingImage" accept="image/jpeg,image/png,image/webp"></label>
          <div id="landingImagePreview" style="margin-top:12px"></div>
          <input type="hidden" name="hero_image_url">
        </div>
        <div class="article-card" style="margin-top:16px">
          <h3 style="margin-top:0">Pengaturan SEO</h3>
          <label>SEO Title<input name="seo_title" maxlength="70" placeholder="Judul SEO (maks. 70 karakter)"></label>
          <label>Meta Description<textarea name="seo_description" rows="3" maxlength="170" placeholder="Deskripsi SEO (maks. 170 karakter)"></textarea></label>
        </div>
        <div class="row" style="align-items:center;justify-content:space-between;margin-top:18px;gap:10px;flex-wrap:wrap">
          <button class="btn" id="landingCancel" type="button">Kembali ke Daftar</button>
          <div class="head-actions"><button class="btn" id="landingSaveDraft" type="button">Simpan Draft</button><button class="btn primary" type="submit">Publikasikan</button></div>
        </div>
      </form>
    </section>
    <section id="landingList" class="article-list-card" style="margin-top:18px">
      <div class="row" style="align-items:center;justify-content:space-between"><div><h2 style="margin:0;font-size:18px">Daftar Landing Page</h2><p class="page-subtitle">Kelola draft dan halaman yang sudah diterbitkan.</p></div></div>
      <div id="landingTable" class="table-wrap">Memuat data...</div>
    </section>`;
  $("adminView").append(panel);
  bindEditor();
}
function setEditorVisible(show) {
  $("landingEditor").classList.toggle("hidden", !show);
  $("landingList").classList.toggle("hidden", show);
  if (show) $("landingEditor").scrollIntoView({behavior:"smooth",block:"start"});
}
function resetEditor() {
  editingId = null; slugTouched = false;
  $("landingForm").reset();
  $("landingForm").elements.id.value = "";
  $("landingForm").elements.hero_image_url.value = "";
  $("landingContent").innerHTML = "";
  $("landingImagePreview").innerHTML = "";
  $("landingImage").value = "";
  $("landingForm").elements.title.focus();
  setEditorVisible(true);
}
function bindEditor() {
  $("landingNew").addEventListener("click", resetEditor);
  $("landingRefresh").addEventListener("click", loadPages);
  $("landingCancel").addEventListener("click", () => setEditorVisible(false));
  $("landingForm").elements.title.addEventListener("input", () => {
    if (!slugTouched) $("landingForm").elements.slug.value = slugify($("landingForm").elements.title.value);
  });
  $("landingForm").elements.slug.addEventListener("input", () => { slugTouched = true; $("landingForm").elements.slug.value = slugify($("landingForm").elements.slug.value); });
  $("landingCopyUrl").addEventListener("click", async () => {
    const slug = $("landingForm").elements.slug.value.trim();
    if (!slug) return status("Isi slug terlebih dahulu.", true);
    await navigator.clipboard.writeText(location.origin + "/landingpage/" + slug);
    status("URL landing page berhasil disalin.");
  });
  $("landingToolbar").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
  $("landingToolbar").addEventListener("click", e => {
    const button = e.target.closest("[data-cmd]"); if (!button) return;
    const cmd = button.dataset.cmd, editor = $("landingContent"); editor.focus();
    const commands = {bold:"bold",italic:"italic",ul:"insertUnorderedList",ol:"insertOrderedList",quote:"formatBlock"};
    if (cmd === "h2" || cmd === "h3") document.execCommand("formatBlock",false,cmd);
    else if (cmd === "link") {
      const selected = window.getSelection()?.toString() || "";
      if (!selected) return status("Pilih teks yang akan diberi tautan.", true);
      const url = window.prompt("Masukkan URL internal (/...) atau eksternal (https://...):");
      if (url && /^(https?:\/\/|\/)/i.test(url.trim()) && !url.trim().startsWith("//")) document.execCommand("createLink",false,url.trim());
    } else if (commands[cmd]) document.execCommand(commands[cmd],false,cmd === "quote" ? "blockquote" : null);
  });
  $("landingImage").addEventListener("change", previewImage);
  $("landingSaveDraft").addEventListener("click", async () => {
    try { await savePage("draft"); } catch (e) { status("Gagal menyimpan draft: " + (e.message || e), true); }
  });
  $("landingForm").addEventListener("submit", async e => {
    e.preventDefault();
    try { await savePage("published"); } catch (err) { status("Gagal menerbitkan: " + (err.message || err), true); }
  });
  $("landingTable").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-delete]");
    if (edit) await editPage(edit.dataset.edit);
    if (del) await deletePage(del.dataset.delete);
  });
}
function previewImage() {
  const file = $("landingImage").files?.[0], box = $("landingImagePreview");
  if (!file) { box.innerHTML = ""; return; }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8*1024*1024) {
    $("landingImage").value = ""; box.innerHTML = ""; status("Format gambar harus JPG, PNG, atau WebP dan maksimal 8 MB.", true); return;
  }
  const url = URL.createObjectURL(file);
  box.innerHTML = '<img src="' + url + '" alt="Pratinjau gambar landing page" style="max-width:100%;max-height:260px;object-fit:contain;border-radius:10px">';
}
async function uploadImage() {
  const file = $("landingImage").files?.[0];
  if (!file) return $("landingForm").elements.hero_image_url.value || null;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8*1024*1024) throw new Error("Format gambar tidak didukung atau ukuran melebihi 8 MB.");
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = user.id + "/" + crypto.randomUUID() + "." + ext;
  const {error} = await db.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function savePage(nextStatus) {
  const form = $("landingForm"), title = form.elements.title.value.trim(), slug = slugify(form.elements.slug.value);
  if (!title || !slug) throw new Error("Judul dan slug wajib diisi.");
  const html = $("landingContent").innerHTML.trim();
  if (!html) throw new Error("Konten landing page belum diisi.");
  const button = nextStatus === "draft" ? $("landingSaveDraft") : form.querySelector('button[type="submit"]');
  button.disabled = true; status(nextStatus === "draft" ? "Menyimpan draft..." : "Menerbitkan landing page...");
  try {
    const imageUrl = await uploadImage();
    const now = new Date().toISOString();
    const payload = {
      title, slug, excerpt: form.elements.excerpt.value.trim(),
      content_html: html, hero_image_url: imageUrl,
      seo_title: form.elements.seo_title.value.trim() || title,
      seo_description: form.elements.seo_description.value.trim() || form.elements.excerpt.value.trim(),
      status: nextStatus, updated_by: user.id, updated_at: now,
      published_at: nextStatus === "published" ? now : null
    };
    if (editingId) payload.id = editingId;
    else payload.created_by = user.id;
    const {data,error} = await db.from("landing_pages").upsert(payload,{onConflict:"id"}).select("id").single();
    if (error) throw error;
    editingId = data.id;
    form.elements.id.value = data.id;
    form.elements.slug.value = slug;
    status(nextStatus === "draft" ? "Draft berhasil disimpan." : "Landing page berhasil diterbitkan: " + location.origin + "/landingpage/" + slug);
    $("landingImage").value = "";
    await loadPages();
    setEditorVisible(false);
  } finally { button.disabled = false; }
}
async function loadPages() {
  status("Memuat daftar landing page...");
  const {data,error} = await db.from("landing_pages").select("id,title,slug,excerpt,status,seo_title,seo_description,hero_image_url,content_html,created_at,updated_at,published_at").order("updated_at",{ascending:false});
  if (error) throw error;
  $("landingTable").innerHTML = data.length ? `<table><thead><tr><th>Judul</th><th>URL</th><th>Status</th><th>Terakhir diubah</th><th>Aksi</th></tr></thead><tbody>${data.map(row => {
    const url = "/landingpage/" + encodeURIComponent(row.slug);
    return '<tr><td><strong>' + esc(row.title) + '</strong><br><small>' + esc(row.excerpt || "") + '</small></td><td><a href="' + url + '" target="_blank" rel="noopener">/landingpage/' + esc(row.slug) + '</a></td><td>' + (row.status === "published" ? '<span class="badge success">Published</span>' : '<span class="badge">Draft</span>') + '</td><td>' + esc(new Date(row.updated_at || row.created_at).toLocaleString("id-ID")) + '</td><td><button class="btn" type="button" data-edit="' + esc(row.id) + '">Edit</button> <button class="btn" type="button" data-delete="' + esc(row.id) + '">Hapus</button></td></tr>';
  }).join("")}</tbody></table>` : '<p class="muted">Belum ada landing page. Klik “Landing Page Baru” untuk membuat halaman pertama.</p>';
  status("Daftar landing page berhasil dimuat (" + data.length + " halaman).");
}
async function editPage(id) {
  const {data,error} = await db.from("landing_pages").select("*").eq("id",id).single();
  if (error) throw error;
  editingId = id; slugTouched = true;
  const f = $("landingForm");
  for (const key of ["id","title","slug","excerpt","seo_title","seo_description","hero_image_url"]) if (f.elements[key]) f.elements[key].value = data[key] || "";
  $("landingContent").innerHTML = data.content_html || "";
  $("landingImagePreview").innerHTML = data.hero_image_url ? '<img src="' + esc(data.hero_image_url) + '" alt="Gambar utama" style="max-width:100%;max-height:260px;object-fit:contain;border-radius:10px">' : "";
  $("landingImage").value = "";
  setEditorVisible(true);
  status("Mengedit: " + data.title);
}
async function deletePage(id) {
  if (!confirm("Hapus landing page ini? Tindakan ini tidak dapat dibatalkan.")) return;
  const {error} = await db.from("landing_pages").delete().eq("id",id);
  if (error) throw error;
  status("Landing page berhasil dihapus.");
  await loadPages();
}
async function initialize() {
  if (!initialized) {
    panelMarkup();
    const {data:{session},error:sessionError} = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
    user = session.user;
    const {data:profile,error} = await db.from("profiles").select("role").eq("id",user.id).single();
    if (error) throw error;
    if (!["admin","super_admin"].includes(profile.role)) throw new Error("Akun tidak memiliki akses mengelola landing page.");
    role = profile.role; initialized = true;
  }
  setEditorVisible(false);
  await loadPages();
}
window.addEventListener("cms:landing-pages-open", () => {
  initialize().catch(error => status("Modul Landing Page gagal dimuat: " + (error.message || error), true));
});
