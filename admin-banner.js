import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const BUCKET = "site-banner-images";
let user = null, initialized = false;

function message(text, error=false) {
  const el = $("bannerAdminStatus");
  if (el) { el.textContent = text; el.style.color = error ? "#b42318" : "#17633f"; }
}
function panelMarkup() {
  if ($("siteBannerPanel")) return;
  const panel = document.createElement("section");
  panel.id = "siteBannerPanel";
  panel.className = "panel";
  panel.innerHTML = `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px">
      <div><h1 class="page-title">Banner Utama Website</h1><p class="page-subtitle">Atur teks, tombol, warna, dan gambar banner pada halaman beranda Bos Pangan.</p></div>
      <a class="btn" href="/" target="_blank" rel="noopener">Lihat Website ↗</a>
    </div>
    <p id="bannerAdminStatus" role="status" aria-live="polite">Memuat pengaturan banner...</p>
    <form id="siteBannerForm">
      <div class="article-card">
        <h2 style="margin-top:0">Konten Banner</h2>
        <label class="article-label" for="bannerEyebrow">Teks kecil di atas judul</label>
        <input id="bannerEyebrow" name="eyebrow" maxlength="120" placeholder="Bekasi / Katalog produk">
        <label class="article-label" for="bannerTitle">Judul utama</label>
        <textarea id="bannerTitle" name="title" rows="3" maxlength="220" required placeholder="Pilihan produk pangan untuk kebutuhan Anda."></textarea>
        <p class="muted">Gunakan baris baru jika ingin memisahkan judul menjadi beberapa baris.</p>
        <label class="article-label" for="bannerDescription">Deskripsi</label>
        <textarea id="bannerDescription" name="description" rows="3" maxlength="500" placeholder="Tulis deskripsi singkat banner"></textarea>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
          <div><label class="article-label" for="bannerCtaLabel">Teks tombol</label><input id="bannerCtaLabel" name="cta_label" maxlength="80" placeholder="Katalog kebutuhan harian"></div>
          <div><label class="article-label" for="bannerCtaUrl">Tautan tombol</label><input id="bannerCtaUrl" name="cta_url" maxlength="500" placeholder="/#katalog"></div>
        </div>
      </div>
      <div class="article-card" style="margin-top:16px">
        <h2 style="margin-top:0">Tampilan Banner</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;align-items:end">
          <div><label class="article-label" for="bannerColor">Warna latar</label><div style="display:flex;gap:10px;align-items:center"><input id="bannerColor" name="background_color" type="color" value="#cf1b1d" style="width:64px;height:44px;padding:3px"><input id="bannerColorText" type="text" value="#cf1b1d" maxlength="7" aria-label="Kode warna" style="max-width:140px"></div></div>
          <div><label class="article-label" for="bannerImage">Gambar banner (opsional)</label><input id="bannerImage" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">JPG, PNG, WebP. Maksimal 8 MB.</small></div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px"><img id="bannerImagePreview" alt="Pratinjau banner" style="display:none;max-width:260px;max-height:130px;object-fit:cover;border-radius:10px"><button class="btn" id="bannerRemoveImage" type="button">Hapus gambar</button><span class="muted" id="bannerImageState">Tidak ada gambar tambahan.</span></div>
        <label style="display:flex;gap:10px;align-items:center;margin-top:18px"><input id="bannerActive" type="checkbox" checked style="width:auto"> Tampilkan banner di halaman utama</label>
      </div>
      <div class="article-card" style="margin-top:16px">
        <h2 style="margin-top:0">Pratinjau</h2>
        <div id="bannerLivePreview" style="min-height:230px;border-radius:18px;padding:clamp(22px,4vw,44px);background:#cf1b1d;color:white;display:flex;flex-direction:column;justify-content:center;background-position:center;background-size:cover">
          <div id="bannerPreviewEyebrow" style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Bekasi / Katalog produk</div>
          <div id="bannerPreviewTitle" style="font:700 clamp(28px,4vw,52px)/1.08 Georgia,serif;max-width:850px;margin:14px 0">Pilihan produk pangan untuk kebutuhan Anda.</div>
          <div id="bannerPreviewDescription" style="max-width:700px;line-height:1.6">Temukan berbagai kebutuhan pangan dan produk harian dalam satu katalog.</div>
          <span id="bannerPreviewCta" style="align-self:flex-start;border:1px solid rgba(255,255,255,.8);border-radius:999px;padding:7px 12px;margin-top:16px">Katalog kebutuhan harian</span>
        </div>
      </div>
      <div class="head-actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn" id="bannerReload" type="button">Muat Ulang</button><button class="btn primary" id="bannerSave" type="submit">Simpan Perubahan</button></div>
    </form>`;
  $("adminView").append(panel);
  bind();
}
function updatePreview() {
  const f = $("siteBannerForm"), color = f.elements.background_color.value;
  $("bannerPreviewEyebrow").textContent = f.elements.eyebrow.value || " ";
  $("bannerPreviewTitle").textContent = f.elements.title.value || "Judul banner";
  $("bannerPreviewDescription").textContent = f.elements.description.value || "";
  $("bannerPreviewCta").textContent = f.elements.cta_label.value || "Tombol";
  const preview = $("bannerLivePreview");
  preview.style.backgroundColor = color;
  const url = $("bannerImagePreview").dataset.previewUrl || $("bannerImagePreview").dataset.url || "";
  preview.style.backgroundImage = url ? "linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.08)),url('" + url.replace(/['()\\]/g,"") + "')" : "none";
}
function bind() {
  const form = $("siteBannerForm");
  form.addEventListener("input", e => {
    if (e.target.id === "bannerColorText") {
      const value = e.target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(value)) $("bannerColor").value = value;
    } else if (e.target.id === "bannerColor") $("bannerColorText").value = e.target.value;
    updatePreview();
  });
  $("bannerImage").addEventListener("change", () => {
    const file = $("bannerImage").files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8*1024*1024) {
      $("bannerImage").value = ""; message("Gambar harus JPG, PNG, atau WebP dan maksimal 8 MB.", true); return;
    }
    const url = URL.createObjectURL(file);
    $("bannerImagePreview").src = url;
    $("bannerImagePreview").style.display = "block";
    $("bannerImagePreview").dataset.local = "1";
    $("bannerImagePreview").dataset.previewUrl = url;
    $("bannerImageState").textContent = file.name;
    updatePreview();
    $("bannerLivePreview").style.backgroundImage = "linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.08)),url('" + url + "')";
  });
  $("bannerRemoveImage").addEventListener("click", () => {
    $("bannerImage").value = "";
    $("bannerImagePreview").removeAttribute("src");
    $("bannerImagePreview").dataset.url = "";
    $("bannerImagePreview").dataset.local = "";
    $("bannerImagePreview").style.display = "none";
    $("bannerImageState").textContent = "Gambar akan dihapus setelah disimpan.";
    updatePreview();
  });
  $("bannerReload").addEventListener("click", loadBanner);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const button = $("bannerSave"); button.disabled = true;
    try { await saveBanner(); } catch (err) { message("Gagal menyimpan banner: " + (err.message || err), true); }
    finally { button.disabled = false; }
  });
}
async function loadBanner() {
  message("Memuat pengaturan banner...");
  const {data,error} = await db.from("site_banners").select("*").eq("id","home").maybeSingle();
  if (error) throw error;
  const f = $("siteBannerForm");
  const value = data || {};
  for (const [key,id] of [["eyebrow","bannerEyebrow"],["title","bannerTitle"],["description","bannerDescription"],["cta_label","bannerCtaLabel"],["cta_url","bannerCtaUrl"]]) $(id).value = value[key] || "";
  const color = /^#[0-9a-fA-F]{6}$/.test(value.background_color || "") ? value.background_color : "#cf1b1d";
  $("bannerColor").value = color; $("bannerColorText").value = color;
  $("bannerActive").checked = value.is_active !== false;
  $("bannerImage").value = "";
  $("bannerImagePreview").dataset.url = value.background_image_url || "";
  $("bannerImagePreview").dataset.local = "";
  if (value.background_image_url) {
    $("bannerImagePreview").src = value.background_image_url;
    $("bannerImagePreview").style.display = "block";
    $("bannerImageState").textContent = "Gambar tersimpan.";
  } else {
    $("bannerImagePreview").removeAttribute("src");
    $("bannerImagePreview").style.display = "none";
    $("bannerImageState").textContent = "Tidak ada gambar tambahan.";
  }
  updatePreview();
  message(data ? "Pengaturan banner berhasil dimuat." : "Belum ada pengaturan tersimpan. Isi formulir lalu simpan.");
}
async function saveBanner() {
  const f = $("siteBannerForm"), title = f.elements.title.value.trim();
  if (!title) throw new Error("Judul utama wajib diisi.");
  const color = f.elements.background_color.value;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Kode warna tidak valid.");
  let imageUrl = $("bannerImagePreview").dataset.url || null;
  const file = $("bannerImage").files?.[0];
  if (file) {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = user.id + "/" + crypto.randomUUID() + "." + ext;
    const {error} = await db.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if (error) throw error;
    imageUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const ctaUrl = f.elements.cta_url.value.trim();
  if (ctaUrl && !/^(https?:\/\/|\/)/i.test(ctaUrl)) throw new Error("Tautan tombol harus berupa URL https:// atau tautan internal yang diawali /.");
  const payload = {
    id:"home", eyebrow:f.elements.eyebrow.value.trim(), title,
    description:f.elements.description.value.trim(), cta_label:f.elements.cta_label.value.trim(),
    cta_url:ctaUrl || "/#katalog", background_color:color,
    background_image_url:imageUrl, is_active:$("bannerActive").checked,
    updated_by:user.id, updated_at:new Date().toISOString()
  };
  const {error} = await db.from("site_banners").upsert(payload,{onConflict:"id"});
  if (error) throw error;
  $("bannerImage").value = "";
  message("Banner berhasil disimpan. Muat ulang halaman utama untuk melihat perubahan.");
}
async function initialize() {
  panelMarkup();
  if (!initialized) {
    const {data:{session},error:sessionError} = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
    user = session.user;
    const {data:profile,error} = await db.from("profiles").select("role").eq("id",user.id).single();
    if (error) throw error;
    if (!["admin","super_admin"].includes(profile.role)) throw new Error("Akun tidak memiliki akses mengelola banner.");
    initialized = true;
  }
  await loadBanner();
}
window.addEventListener("cms:banner-open", () => initialize().catch(error => message("Modul Banner gagal dimuat: " + (error.message || error),true)));
