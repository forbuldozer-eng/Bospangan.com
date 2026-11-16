import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const BUCKET = "site-banner-images";
let user = null;
let initialized = false;
let removeCurrentImage = false;

function setStatus(text, error = false) {
  const node = $("bannerAdminStatus");
  if (!node) return;
  node.textContent = text;
  node.style.color = error ? "#b42318" : "#17633f";
}

function renderPanel() {
  if ($("siteBannerPanel")) return;
  const panel = document.createElement("section");
  panel.id = "siteBannerPanel";
  panel.className = "panel";
  panel.innerHTML = `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px">
      <div>
        <h1 class="page-title">Banner Utama Website</h1>
        <p class="page-subtitle">Ganti gambar banner yang tampil di halaman utama Bos Pangan.</p>
      </div>
      <a class="btn" href="/" target="_blank" rel="noopener">Lihat Website ↗</a>
    </div>
    <div class="article-card" style="max-width:100%">
      <p id="bannerAdminStatus" role="status" aria-live="polite">Memuat banner utama...</p>
      <label class="article-label" for="homeBannerFile">Pilih gambar banner utama</label>
      <input id="homeBannerFile" type="file" accept="image/jpeg,image/png,image/webp">
      <p class="muted">Format JPG, PNG, atau WebP. Maksimal 8 MB. Gambar ini akan menggantikan tampilan banner utama di halaman Beranda.</p>
      <div id="homeBannerPreviewWrap" style="margin-top:18px">
        <p class="article-label">Pratinjau banner saat ini</p>
        <img id="homeBannerPreview" alt="Pratinjau banner utama" style="display:none;width:100%;height:auto;max-height:480px;object-fit:contain;object-position:center;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc">
        <p id="homeBannerEmpty" class="muted">Belum ada gambar banner tersimpan.</p>
      </div>
      <div class="head-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
        <button class="btn" id="homeBannerRemove" type="button">Hapus gambar banner</button>
        <button class="btn primary" id="homeBannerSave" type="button">Simpan Banner Utama</button>
      </div>
    </div>`;
  $("adminView").append(panel);
  $("homeBannerFile").addEventListener("change", previewSelectedFile);
  $("homeBannerRemove").addEventListener("click", markImageForRemoval);
  $("homeBannerSave").addEventListener("click", saveBanner);
}

function showPreview(url) {
  const img = $("homeBannerPreview");
  const empty = $("homeBannerEmpty");
  if (url) {
    img.src = url;
    img.style.display = "block";
    empty.style.display = "none";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    empty.style.display = "block";
  }
}

function previewSelectedFile() {
  const file = $("homeBannerFile").files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    $("homeBannerFile").value = "";
    setStatus("Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 8 MB.", true);
    return;
  }
  removeCurrentImage = false;
  showPreview(URL.createObjectURL(file));
  setStatus("Pratinjau gambar baru. Klik Simpan Banner Utama untuk menerapkannya.");
}

function markImageForRemoval() {
  $("homeBannerFile").value = "";
  removeCurrentImage = true;
  showPreview("");
  setStatus("Gambar akan dihapus dari banner utama setelah Anda menyimpan.");
}

async function loadBanner() {
  setStatus("Memuat gambar banner...");
  const { data, error } = await db.from("site_banners")
    .select("background_image_url")
    .eq("id", "home")
    .maybeSingle();
  if (error) throw error;
  showPreview(data?.background_image_url || "");
  removeCurrentImage = false;
  $("homeBannerFile").value = "";
  setStatus(data?.background_image_url ? "Banner utama berhasil dimuat." : "Belum ada gambar banner. Silakan pilih gambar.");
}

async function saveBanner() {
  const button = $("homeBannerSave");
  const file = $("homeBannerFile").files?.[0];
  if (!file && !removeCurrentImage) {
    setStatus("Pilih gambar baru terlebih dahulu, atau klik Hapus gambar banner.", true);
    return;
  }
  button.disabled = true;
  try {
    let imageUrl = null;
    if (file) {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = user.id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      imageUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      id: "home",
      background_image_url: imageUrl,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await db.from("site_banners").upsert(payload, { onConflict: "id" });
    if (error) throw error;

    removeCurrentImage = false;
    $("homeBannerFile").value = "";
    showPreview(imageUrl);
    setStatus("Banner utama berhasil disimpan. Periksa halaman Beranda website.");
  } catch (error) {
    setStatus("Gagal menyimpan banner: " + (error.message || error), true);
  } finally {
    button.disabled = false;
  }
}

async function initialize() {
  renderPanel();
  if (!initialized) {
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
    user = session.user;
    const { data: profile, error } = await db.from("profiles")
      .select("role").eq("id", user.id).single();
    if (error) throw error;
    if (!["admin", "super_admin"].includes(profile.role)) {
      throw new Error("Akun tidak memiliki akses mengelola banner.");
    }
    initialized = true;
  }
  await loadBanner();
}

window.addEventListener("cms:banner-open", () => {
  initialize().catch(error => setStatus("Modul Banner gagal dimuat: " + (error.message || error), true));
});
