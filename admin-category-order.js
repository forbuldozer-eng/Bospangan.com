import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.getElementById("adminView");
const TABLE = "homepage_category_order";
const DEFAULTS = [
  ["daging-sapi", "Daging sapi"],
  ["ikan", "Ikan"],
  ["ayam", "Ayam"],
  ["sayuran", "Sayuran"],
  ["minyak", "Minyak"],
  ["beras", "Beras"],
  ["bumbu-dapur", "Bumbu dapur"],
  ["buah", "Buah"],
  ["bebek", "Bebek"]
];

let rows = [];
let busy = false;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

function setStatus(message, error = false) {
  const node = document.getElementById("categoryOrderStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = error ? "#b42318" : "#176b45";
  node.style.background = error ? "#fff1f0" : "#edf8f1";
}

function render() {
  const list = document.getElementById("categoryOrderList");
  if (!list) return;
  list.innerHTML = rows.map((row, index) => `
    <div class="category-order-row" data-index="${index}" style="display:grid;grid-template-columns:42px minmax(130px,1fr) auto auto;align-items:center;gap:12px;padding:13px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin:8px 0">
      <span style="font-weight:800;color:#64748b;text-align:center">${index + 1}</span>
      <strong>${esc(row.name)}</strong>
      <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:#475569"><input type="checkbox" data-visible="${index}" ${row.is_visible ? "checked" : ""} style="width:auto"> Tampilkan</label>
      <span style="display:flex;gap:5px">
        <button type="button" data-up="${index}" aria-label="Naikkan kategori" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-down="${index}" aria-label="Turunkan kategori" ${index === rows.length - 1 ? "disabled" : ""}>↓</button>
      </span>
    </div>`).join("");

  list.querySelectorAll("[data-up]").forEach(button => button.addEventListener("click", () => move(Number(button.dataset.up), -1)));
  list.querySelectorAll("[data-down]").forEach(button => button.addEventListener("click", () => move(Number(button.dataset.down), 1)));
  list.querySelectorAll("[data-visible]").forEach(input => input.addEventListener("change", () => {
    rows[Number(input.dataset.visible)].is_visible = input.checked;
  }));
}

function move(index, offset) {
  const next = index + offset;
  if (next < 0 || next >= rows.length) return;
  [rows[index], rows[next]] = [rows[next], rows[index]];
  render();
}

async function load() {
  setStatus("Memuat urutan kategori dari Supabase…");
  const { data, error } = await db.from(TABLE).select("slug,name,sort_order,is_visible").order("sort_order", { ascending: true });
  if (error) {
    rows = [];
    render();
    setStatus("Tabel urutan kategori belum tersedia. Jalankan SQL supabase/homepage-category-order.sql di Supabase SQL Editor, lalu klik Muat Ulang.", true);
    return;
  }

  if (!data?.length) {
    const initial = DEFAULTS.map(([slug, name], index) => ({
      slug, name, sort_order: index + 1, is_visible: true
    }));
    const { error: seedError } = await db.from(TABLE).upsert(initial, { onConflict: "slug" });
    if (seedError) {
      setStatus("Kategori awal gagal disiapkan: " + seedError.message, true);
      return;
    }
    rows = initial;
  } else {
    const bySlug = new Map(data.map(item => [item.slug, item]));
    rows = DEFAULTS.map(([slug, name], index) => bySlug.get(slug) || ({
      slug, name, sort_order: index + 1, is_visible: true
    })).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  }
  render();
  setStatus("Urutan kategori berhasil dimuat. Atur posisi dan visibilitas, lalu simpan perubahan.");
}

async function save() {
  if (busy || !rows.length) return;
  busy = true;
  const saveButton = document.getElementById("saveCategoryOrder");
  saveButton.disabled = true;
  setStatus("Menyimpan perubahan kategori…");
  const payload = rows.map((row, index) => ({
    slug: row.slug,
    name: row.name,
    sort_order: index + 1,
    is_visible: Boolean(row.is_visible),
    updated_at: new Date().toISOString()
  }));
  const { error } = await db.from(TABLE).upsert(payload, { onConflict: "slug" });
  busy = false;
  saveButton.disabled = false;
  if (error) {
    setStatus("Gagal menyimpan: " + error.message, true);
    return;
  }
  rows = payload;
  render();
  setStatus("Berhasil disimpan. Urutan kategori pada halaman utama akan diperbarui.");
}

function mount() {
  if (!root || document.getElementById("categoryOrderPanel")) return;
  const panel = document.createElement("section");
  panel.id = "categoryOrderPanel";
  panel.className = "panel hidden";
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div><h2>Urutan Kategori</h2><p class="muted">Atur posisi kategori yang tampil pada halaman utama Bos Pangan.</p></div>
      <button class="btn" type="button" id="reloadCategoryOrder">Muat Ulang</button>
    </div>
    <div id="categoryOrderStatus" role="status" style="padding:12px 14px;border-radius:10px;background:#edf8f1;margin:14px 0">Menyiapkan modul…</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <strong>Daftar kategori halaman utama</strong><small class="muted">Gunakan ↑ dan ↓ untuk mengubah urutan.</small>
    </div>
    <div id="categoryOrderList" style="margin:12px 0"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
      <button class="btn primary" type="button" id="saveCategoryOrder">Simpan Urutan</button>
    </div>
  `;
  root.appendChild(panel);
  document.getElementById("reloadCategoryOrder").addEventListener("click", load);
  document.getElementById("saveCategoryOrder").addEventListener("click", save);
}

mount();
window.addEventListener("cms:category-order-open", () => {
  mount();
  document.getElementById("categoryOrderPanel")?.classList.remove("hidden");
  load();
});
