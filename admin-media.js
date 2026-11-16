import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const UPLOAD_BUCKET = "site-media";
const LIBRARY_BUCKETS = [
  "site-media",
  "product-images",
  "cms-article-images",
  "site-banner-images",
  "landing-page-images"
];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_LIMIT = 8 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
let mediaItems = [];
let initialized = false;

function setStatus(message, error = false) {
  const node = $("mediaStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = error ? "#b42318" : "#17633f";
}

function panelMarkup() {
  if ($("mediaAdminPanel")) return;
  const panel = document.createElement("section");
  panel.id = "mediaAdminPanel";
  panel.className = "panel hidden";
  panel.innerHTML = `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px">
      <div>
        <h1 class="page-title">Media &amp; Galeri</h1>
        <p class="page-subtitle">Pusat penyimpanan gambar dan video website Bos Pangan menggunakan Supabase Storage.</p>
      </div>
      <div class="head-actions">
        <button class="btn" id="mediaRefresh" type="button">Muat Ulang</button>
      </div>
    </div>
    <div class="panel" style="margin-bottom:16px">
      <h2 style="font-size:18px;margin-top:0">Unggah Media Baru</h2>
      <p class="muted">File baru disimpan di penyimpanan bersama <strong>site-media</strong>. Gambar maksimal 8 MB dan video maksimal 50 MB per file.</p>
      <form id="mediaUploadForm">
        <label for="mediaFiles">Pilih gambar atau video</label>
        <input id="mediaFiles" name="files" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple required>
        <div class="row" style="align-items:center;gap:12px;margin-top:14px">
          <button class="btn primary" id="mediaUploadButton" type="submit">Unggah ke Server</button>
          <span class="muted">Format: JPG, PNG, WebP, MP4, WebM</span>
        </div>
      </form>
    </div>
    <div class="row" style="align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:16px 0">
      <div>
        <h2 style="font-size:18px;margin:0">Perpustakaan Media</h2>
        <p class="muted" style="margin:5px 0 0">Menampilkan file dari penyimpanan media bersama dan bucket lama Bos Pangan.</p>
      </div>
      <div class="row" style="align-items:center;gap:8px;flex-wrap:wrap">
        <input id="mediaSearch" type="search" placeholder="Cari nama file..." style="max-width:220px">
        <select id="mediaTypeFilter" aria-label="Filter jenis media" style="max-width:150px">
          <option value="all">Semua media</option>
          <option value="image">Gambar</option>
          <option value="video">Video</option>
        </select>
      </div>
    </div>
    <p id="mediaStatus" class="status" role="status" aria-live="polite">Memuat media...</p>
    <div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px"></div>
  `;
  $("adminView").append(panel);
  // The first cms:media-open event may fire before this panel exists.
  // Remove the initial hidden class here so the newly mounted panel is visible immediately.
  panel.classList.remove("hidden");
  $("mediaRefresh").addEventListener("click", loadMedia);
  $("mediaSearch").addEventListener("input", renderMedia);
  $("mediaTypeFilter").addEventListener("change", renderMedia);
  $("mediaUploadForm").addEventListener("submit", uploadSelectedFiles);
}

function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function safeFilename(name) {
  return String(name || "media")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120) || "media";
}

async function uploadSelectedFiles(event) {
  event.preventDefault();
  const input = $("mediaFiles");
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const button = $("mediaUploadButton");
  button.disabled = true;
  let uploaded = 0;
  try {
    for (const file of files) {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        throw new Error("Format tidak didukung: " + file.name + ". Gunakan JPG, PNG, WebP, MP4, atau WebM.");
      }
      const limit = isImage ? IMAGE_LIMIT : VIDEO_LIMIT;
      if (file.size > limit) {
        throw new Error(file.name + " melebihi batas " + (isImage ? "8 MB untuk gambar." : "50 MB untuk video."));
      }
      const path = Date.now() + "-" + crypto.randomUUID() + "-" + safeFilename(file.name);
      const { error } = await db.storage.from(UPLOAD_BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw error;
      uploaded++;
      setStatus("Berhasil mengunggah " + uploaded + " dari " + files.length + " file...");
    }
    input.value = "";
    setStatus(uploaded + " file berhasil disimpan di Supabase Storage.");
    await loadMedia();
  } catch (error) {
    setStatus("Upload gagal: " + (error?.message || "Kesalahan tidak diketahui"), true);
  } finally {
    button.disabled = false;
  }
}

async function loadMedia() {
  setStatus("Memuat daftar media dari server...");
  const results = await Promise.all(LIBRARY_BUCKETS.map(async bucket => {
    const { data, error } = await db.storage.from(bucket).list("", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });
    if (error) return { bucket, error, files: [] };
    const files = (data || []).filter(file => file.name && file.id).map(file => {
      const mime = file.metadata?.mimetype || file.metadata?.contentType || "";
      const isVideo = mime.startsWith("video/") || /\.(mp4|webm)$/i.test(file.name);
      const { data: publicData } = db.storage.from(bucket).getPublicUrl(file.name);
      return {
        bucket,
        name: file.name,
        url: publicData.publicUrl,
        mime,
        type: isVideo ? "video" : "image",
        size: file.metadata?.size || 0,
        createdAt: file.created_at || file.updated_at || null
      };
    });
    return { bucket, files };
  }));
  mediaItems = results.flatMap(result => result.files);
  const failures = results.filter(result => result.error);
  if (failures.length && !mediaItems.length) {
    setStatus("Gagal memuat media: " + failures.map(item => item.bucket + " — " + item.error.message).join("; "), true);
  } else {
    setStatus(mediaItems.length + " file ditemukan dari " + LIBRARY_BUCKETS.length + " lokasi penyimpanan." +
      (failures.length ? " Beberapa bucket belum dapat dibaca: " + failures.map(item => item.bucket).join(", ") : ""));
  }
  renderMedia();
}

function renderMedia() {
  const grid = $("mediaGrid");
  if (!grid) return;
  const query = ($("mediaSearch")?.value || "").trim().toLowerCase();
  const filter = $("mediaTypeFilter")?.value || "all";
  const visible = mediaItems.filter(item =>
    (filter === "all" || item.type === filter) &&
    (!query || item.name.toLowerCase().includes(query) || item.bucket.toLowerCase().includes(query))
  );
  if (!visible.length) {
    grid.innerHTML = '<div class="panel" style="grid-column:1/-1;text-align:center;padding:36px"><strong>Belum ada media yang cocok.</strong><p class="muted">Unggah gambar atau video melalui formulir di atas.</p></div>';
    return;
  }
  grid.innerHTML = visible.map(item => {
    const preview = item.type === "video"
      ? '<video src="' + esc(item.url) + '" controls preload="metadata" style="width:100%;height:150px;object-fit:cover;background:#111;border-radius:8px"></video>'
      : '<img src="' + esc(item.url) + '" alt="' + esc(item.name) + '" loading="lazy" style="width:100%;height:150px;object-fit:cover;background:#f1f5f9;border-radius:8px">';
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString("id-ID") : "Tanggal tidak tersedia";
    return '<article class="panel" style="margin:0;padding:12px;min-width:0">' +
      '<div style="margin-bottom:10px">' + preview + '</div>' +
      '<strong style="display:block;overflow-wrap:anywhere">' + esc(item.name) + '</strong>' +
      '<small class="muted">' + esc(item.bucket) + ' · ' + formatSize(item.size) + ' · ' + esc(date) + '</small>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">' +
      '<button class="btn" type="button" data-copy-media="' + esc(item.url) + '">Salin URL</button>' +
      '<button class="btn" type="button" data-delete-media="' + esc(item.bucket) + '::' + esc(item.name) + '">Hapus</button>' +
      '</div></article>';
  }).join("");
  grid.querySelectorAll("[data-copy-media]").forEach(button => button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyMedia);
      setStatus("URL media berhasil disalin.");
    } catch {
      setStatus("Tidak dapat menyalin otomatis. Buka file dan salin URL dari browser.", true);
    }
  }));
  grid.querySelectorAll("[data-delete-media]").forEach(button => button.addEventListener("click", async () => {
    const [bucket, ...nameParts] = button.dataset.deleteMedia.split("::");
    const name = nameParts.join("::");
    if (!confirm("Hapus file " + name + " dari " + bucket + "? File yang sudah digunakan pada halaman website juga akan tidak tersedia.")) return;
    button.disabled = true;
    const { error } = await db.storage.from(bucket).remove([name]);
    if (error) {
      setStatus("Gagal menghapus media: " + error.message, true);
      button.disabled = false;
      return;
    }
    setStatus("Media berhasil dihapus dari " + bucket + ".");
    await loadMedia();
  }));
}

async function initialize() {
  panelMarkup();
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    setStatus("Sesi admin tidak ditemukan. Silakan login kembali.", true);
    return;
  }
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", session.user.id).single();
  if (error) throw error;
  if (!["admin", "super_admin"].includes(profile?.role)) {
    setStatus("Akses ditolak. Hanya Admin dan Super Admin yang dapat mengelola media.", true);
    return;
  }
  await loadMedia();
  initialized = true;
}

window.addEventListener("cms:media-open", async () => {
  if (!initialized) {
    try { await initialize(); }
    catch (error) { setStatus("Modul media gagal dimuat: " + (error?.message || "Kesalahan tidak diketahui"), true); }
  } else {
    await loadMedia();
  }
});
