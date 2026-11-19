import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.getElementById("adminView");
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>\"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const nutrientLabels = {
  water_g:"Air (g)", energy_kcal:"Energi (kkal)", protein_g:"Protein (g)",
  fat_g:"Lemak (g)", carbohydrate_g:"Karbohidrat (g)", fiber_g:"Serat (g)",
  ash_g:"Abu (g)", calcium_mg:"Kalsium (mg)", phosphorus_mg:"Fosfor (mg)",
  iron_mg:"Besi (mg)", sodium_mg:"Natrium (mg)", potassium_mg:"Kalium (mg)",
  copper_mg:"Tembaga (mg)", zinc_mg:"Seng (mg)", retinol_ug:"Retinol (µg)",
  beta_carotene_ug:"Beta-karoten (µg)", total_carotene_ug:"Karoten total (µg)",
  thiamin_mg:"Thiamin (mg)", riboflavin_mg:"Riboflavin (mg)",
  niacin_mg:"Niasin (mg)", vitamin_c_mg:"Vitamin C (mg)"
};
let rows = [];
let busy = false;

function mount() {
  if (!root || $("nutritionImportPanel")) return;
  root.insertAdjacentHTML("beforeend", `
    <section id="nutritionImportPanel" class="hidden">
      <div class="page-head"><div><h1 class="page-title">Data Nutrisi TKPI 2020</h1>
      <p class="page-subtitle">Impor CSV, periksa sumber setiap baris, setujui data, lalu jalankan impor ke katalog.</p></div></div>
      <div id="nutritionImportStatus" class="status" role="status" aria-live="polite">Menyiapkan modul…</div>
      <div class="stats" style="margin:16px 0">
        <article class="stat-card"><div class="stat-top"><span>Total baris dimuat</span><span class="stat-symbol">▤</span></div><strong id="nutritionRowsTotal">0</strong><small>Baris staging</small></article>
        <article class="stat-card"><div class="stat-top"><span>Menunggu pemeriksaan</span><span class="stat-symbol">◷</span></div><strong id="nutritionRowsPending">0</strong><small>Status pending</small></article>
        <article class="stat-card"><div class="stat-top"><span>Disetujui</span><span class="stat-symbol">✓</span></div><strong id="nutritionRowsApproved">0</strong><small>Siap diimpor</small></article>
        <article class="stat-card"><div class="stat-top"><span>Sudah diimpor</span><span class="stat-symbol">↗</span></div><strong id="nutritionRowsImported">0</strong><small>Tetap belum terbit</small></article>
      </div>
      <section class="panel" style="margin:18px 0">
        <h2 style="margin-top:0">1. Unggah CSV staging</h2>
        <p class="muted">Gunakan file hasil <code>tkpi_csv_to_staging.py</code>. Semua baris yang diunggah dipaksa berstatus <strong>pending</strong>; file tidak dapat menyetujui atau menerbitkan data secara otomatis.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="nutritionCsvFile" type="file" accept=".csv,text/csv">
          <button id="nutritionUploadCsv" class="btn primary" type="button">Unggah ke staging</button>
          <button id="nutritionRefresh" class="btn" type="button">Muat ulang</button>
        </div>
        <p class="muted" style="font-size:12px;margin-bottom:0">Pastikan setiap angka, kode, nama bahan, BDD, dan halaman telah dibandingkan dengan PDF sumber. OCR mentah tidak boleh diunggah sebagai data final.</p>
      </section>
      <section class="panel" style="margin:18px 0">
        <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div><h2 style="margin:0">2. Pemeriksaan dan persetujuan</h2><p class="muted" style="margin:5px 0 0">Periksa rincian baris satu per satu sebelum menyetujui.</p></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="nutritionBatchFilter" aria-label="Filter batch"><option value="">Semua batch</option></select>
            <select id="nutritionStatusFilter" aria-label="Filter status">
              <option value="">Semua status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="imported">Imported</option>
            </select>
            <button id="nutritionImportBatch" class="btn primary" type="button">Pilih batch untuk impor</button>
          </div>
        </div>
        <div id="nutritionStagingTable" class="table-wrap" style="margin-top:16px"><p class="muted">Memuat staging…</p></div>
      </section>
      <p class="muted" style="font-size:12px">Keamanan publikasi: proses impor hanya membuat/memperbarui data berstatus reviewed dengan <code>is_published=false</code>. Penerbitan publik tetap merupakan tindakan terpisah dan tidak disediakan pada layar ini.</p>
    </section>
  `);
  $("nutritionRefresh").addEventListener("click", load);
  $("nutritionUploadCsv").addEventListener("click", uploadCsv);
  $("nutritionBatchFilter").addEventListener("change", render);
  $("nutritionStatusFilter").addEventListener("change", render);
  $("nutritionImportBatch").addEventListener("click", importBatch);
  $("nutritionStagingTable").addEventListener("click", handleRowAction);
}

function status(message, error = false) {
  const node = $("nutritionImportStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = error ? "#b42318" : "#176b45";
  node.style.background = error ? "#fff1f0" : "#edf8f1";
}

async function load() {
  if (busy) return;
  status("Memuat data staging TKPI dari Supabase…");
  const { data, error } = await db.from("nutrition_import_staging")
    .select("id,batch_name,tkpi_code,source_page,raw_row,review_status,review_notes,created_at,reviewed_at")
    .order("created_at", { ascending:false }).limit(500);
  if (error) {
    rows = [];
    render();
    status("Gagal membaca staging. Pastikan migrasi TKPI sudah dijalankan dan akun memiliki hak Admin: " + error.message, true);
    return;
  }
  rows = data || [];
  const counts = { pending:0, approved:0, rejected:0, imported:0 };
  rows.forEach(row => { if (counts[row.review_status] !== undefined) counts[row.review_status]++; });
  $("nutritionRowsTotal").textContent = String(rows.length);
  $("nutritionRowsPending").textContent = String(counts.pending);
  $("nutritionRowsApproved").textContent = String(counts.approved);
  $("nutritionRowsImported").textContent = String(counts.imported);
  const batches = [...new Set(rows.map(r => r.batch_name).filter(Boolean))].sort();
  const select = $("nutritionBatchFilter");
  const prior = select.value;
  select.innerHTML = '<option value="">Semua batch</option>' + batches.map(b => '<option value="' + esc(b) + '">' + esc(b) + '</option>').join("");
  if (batches.includes(prior)) select.value = prior;
  status(rows.length + " baris staging berhasil dimuat (maksimal 500 terbaru).");
  render();
}

function render() {
  const target = $("nutritionStagingTable");
  if (!target) return;
  const batch = $("nutritionBatchFilter")?.value || "";
  const state = $("nutritionStatusFilter")?.value || "";
  const filtered = rows.filter(r => (!batch || r.batch_name === batch) && (!state || r.review_status === state));
  const approvedInBatch = rows.filter(r => r.batch_name === batch && r.review_status === "approved").length;
  $("nutritionImportBatch").disabled = !batch || approvedInBatch === 0 || busy;
  $("nutritionImportBatch").textContent = batch ? "Impor " + approvedInBatch + " baris disetujui" : "Pilih batch untuk impor";
  if (!filtered.length) {
    target.innerHTML = '<p class="muted">Belum ada baris pada filter ini. Unggah CSV staging yang sudah diperiksa untuk memulai.</p>';
    return;
  }
  target.innerHTML = '<table><thead><tr><th>Kode / Bahan</th><th>Kategori</th><th>Halaman</th><th>Batch</th><th>Status</th><th>Pemeriksaan</th></tr></thead><tbody>' +
    filtered.map(row => {
      const raw = row.raw_row || {};
      const statusColor = row.review_status === "approved" ? "#176b45" : row.review_status === "rejected" ? "#b42318" : row.review_status === "imported" ? "#344054" : "#9a6700";
      const nutrients = Object.keys(nutrientLabels).map(k => [nutrientLabels[k], raw[k]]).filter(x => x[1] !== null && x[1] !== undefined && x[1] !== "");
      const details = {
        kode_tkpi:row.tkpi_code, nama:raw.name, kategori:raw.category_slug,
        kondisi_bahan:raw.food_state, kode_sumber:raw.source_code,
        halaman_cetak:row.source_page, bdd_persen:raw.edible_portion_percent ?? null,
        komposisi_zat_gizi:nutrients.map(x => ({komponen:x[0],nilai:x[1]})),
        sumber:raw.source_url || "https://repository.kemkes.go.id/book/668",
        catatan_admin:row.review_notes || raw.review_notes || ""
      };
      return '<tr><td><strong>' + esc(row.tkpi_code) + '</strong><br>' + esc(raw.name || "Nama belum diisi") +
        '<details style="margin-top:7px"><summary style="cursor:pointer;color:#176b45">Lihat rincian data</summary><pre style="white-space:pre-wrap;max-width:520px;overflow:auto;background:#f5f7f4;padding:10px;border-radius:8px;font-size:12px">' + esc(JSON.stringify(details,null,2)) + '</pre></details></td>' +
        '<td>' + esc(raw.category_slug || "—") + '</td><td>' + esc(row.source_page ?? "—") + '</td><td>' + esc(row.batch_name) + '</td>' +
        '<td><strong style="color:' + statusColor + '">' + esc(row.review_status) + '</strong></td><td>' +
        (row.review_status === "pending" ? '<button type="button" data-review="approved" data-id="' + esc(row.id) + '">Setujui</button> <button type="button" data-review="rejected" data-id="' + esc(row.id) + '">Tolak</button>' : '<span class="muted">—</span>') +
        '</td></tr>';
    }).join("") + '</tbody></table><p class="muted" style="font-size:12px;margin-top:10px">Menampilkan ' + filtered.length + ' dari ' + rows.length + ' baris terbaru.</p>';
}

async function handleRowAction(event) {
  const button = event.target.closest("[data-review]");
  if (!button || busy) return;
  const row = rows.find(r => r.id === button.dataset.id);
  if (!row || row.review_status !== "pending") return;
  const next = button.dataset.review;
  const confirmText = next === "approved"
    ? "Setujui baris " + row.tkpi_code + "? Pastikan nilai dan sumbernya sudah cocok dengan PDF."
    : "Tolak baris " + row.tkpi_code + "?";
  if (!window.confirm(confirmText)) return;
  busy = true;
  button.disabled = true;
  const { data:authData } = await db.auth.getUser();
  const userId = authData?.user?.id || null;
  const { error } = await db.from("nutrition_import_staging").update({
    review_status:next, reviewed_at:new Date().toISOString(), reviewed_by:userId
  }).eq("id",row.id).eq("review_status","pending");
  busy = false;
  if (error) { status("Status baris gagal diperbarui: " + error.message, true); return; }
  status("Baris " + row.tkpi_code + " diperbarui menjadi " + next + ".");
  await load();
}

function parseCsv(text) {
  const matrix = [];
  let row = [], field = "", quoted = false;
  for (let i=0;i<text.length;i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/,"")); matrix.push(row); row=[]; field=""; }
    else field += ch;
  }
  if (quoted) throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");
  if (field.length || row.length) { row.push(field.replace(/\r$/,"")); matrix.push(row); }
  if (matrix.length < 2) throw new Error("CSV belum berisi baris data.");
  const headers = matrix.shift().map(h => h.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV memiliki nama kolom duplikat.");
  return matrix.filter(r => r.some(v => v.trim() !== "")).map(values => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = values[i] ?? "");
    return obj;
  });
}

async function uploadCsv() {
  if (busy) return;
  const file = $("nutritionCsvFile").files?.[0];
  if (!file) { status("Pilih file CSV staging terlebih dahulu.", true); return; }
  busy = true;
  $("nutritionUploadCsv").disabled = true;
  try {
    const csvRows = parseCsv(await file.text());
    if (csvRows.length > 500) throw new Error("Maksimal 500 baris per unggahan. Pecah CSV menjadi beberapa batch kecil.");
    const required = ["batch_name","tkpi_code","source_page","raw_row"];
    const missing = required.filter(k => !(k in csvRows[0]));
    if (missing.length) throw new Error("Kolom CSV staging tidak lengkap: " + missing.join(", "));
    const seen = new Set();
    const payload = csvRows.map((r,index) => {
      const code = String(r.tkpi_code || "").trim();
      const batch = String(r.batch_name || "").trim();
      const page = String(r.source_page || "").trim();
      if (!code || !batch || !/^[0-9]+$/.test(page) || Number(page) < 1) throw new Error("Baris CSV ke-" + (index+2) + " memiliki batch, kode, atau halaman yang tidak valid.");
      const key = batch + "::" + code;
      if (seen.has(key)) throw new Error("Kode TKPI duplikat dalam batch: " + code);
      seen.add(key);
      let raw;
      try { raw = JSON.parse(r.raw_row); } catch { throw new Error("raw_row bukan JSON valid pada kode " + code + "."); }
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || !String(raw.name || "").trim() || !String(raw.category_slug || "").trim()) {
        throw new Error("Nama bahan atau kategori kosong pada kode " + code + ".");
      }
      Object.keys(nutrientLabels).forEach(k => {
        const value = raw[k];
        if (value !== null && value !== undefined && value !== "" && !/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(String(value))) {
          throw new Error("Nilai " + k + " tidak valid pada kode " + code + ".");
        }
      });
      if (raw.edible_portion_percent !== null && raw.edible_portion_percent !== undefined && raw.edible_portion_percent !== "") {
        const bdd = Number(raw.edible_portion_percent);
        if (!Number.isFinite(bdd) || bdd < 0 || bdd > 100) throw new Error("BDD di luar 0–100 pada kode " + code + ".");
      }
      return {
        batch_name:batch, tkpi_code:code, source_page:Number(page), raw_row:raw,
        ocr_confidence:null, review_status:"pending",
        review_notes:String(r.review_notes || "Menunggu pemeriksaan visual admin terhadap PDF sumber.")
      };
    });
    const batches = [...new Set(payload.map(r => r.batch_name))];
    if (batches.length !== 1) throw new Error("Satu file hanya boleh berisi satu batch.");
    const existing = await db.from("nutrition_import_staging").select("tkpi_code").eq("batch_name",batches[0]).range(0,4999);
    if (existing.error) throw existing.error;
    const existingCodes = new Set((existing.data || []).map(r => r.tkpi_code));
    const duplicate = payload.find(r => existingCodes.has(r.tkpi_code));
    if (duplicate) throw new Error("Kode " + duplicate.tkpi_code + " sudah ada di batch " + batches[0] + ".");
    const { error } = await db.from("nutrition_import_staging").insert(payload);
    if (error) throw error;
    $("nutritionCsvFile").value = "";
    status(payload.length + " baris berhasil diunggah ke batch " + batches[0] + ". Semua baris tetap pending.");
    busy = false;
    await load();
  } catch (error) {
    status("CSV tidak diunggah: " + (error?.message || String(error)), true);
  } finally {
    busy = false;
    $("nutritionUploadCsv").disabled = false;
  }
}

async function importBatch() {
  if (busy) return;
  const batch = $("nutritionBatchFilter").value;
  if (!batch) { status("Pilih satu batch sebelum menjalankan impor.", true); return; }
  const count = rows.filter(r => r.batch_name === batch && r.review_status === "approved").length;
  if (!count) { status("Batch ini belum memiliki baris yang disetujui.", true); return; }
  if (!window.confirm("Impor " + count + " baris yang sudah disetujui dari batch " + batch + "? Data akan tetap tidak terbit di website.")) return;
  busy = true;
  $("nutritionImportBatch").disabled = true;
  status("Menjalankan impor batch " + batch + "…");
  const { data, error } = await db.rpc("import_approved_tkpi_rows", { p_batch_name:batch });
  busy = false;
  if (error) {
    status("Impor gagal: " + error.message, true);
    render();
    return;
  }
  status(String(data ?? 0) + " bahan berhasil diimpor sebagai data reviewed dan tetap unpublished.");
  await load();
}

mount();
window.addEventListener("cms:nutrition-import-open", () => {
  $("nutritionImportPanel")?.classList.remove("hidden");
  load();
});
