import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const money = value => "Rp" + Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
let customers = [];
let initialized = false;

function status(message, isError = false) {
  const node = $("customerDbStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#b42318" : "#17633f";
}

function mount() {
  if ($("customerDatabasePanel")) return;
  const panel = document.createElement("section");
  panel.id = "customerDatabasePanel";
  panel.className = "panel hidden";
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
      <div><h1 class="page-title">Database Pelanggan</h1><p class="page-subtitle">Kelola kontak pelanggan, akun, dan riwayat transaksi Bos Pangan.</p></div>
      <button class="btn" type="button" id="customerDbRefresh">Muat Ulang</button>
    </div>
    <p id="customerDbStatus" class="status" role="status" aria-live="polite">Menyiapkan database pelanggan...</p>
    <div class="row" style="gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="panel" style="flex:1;min-width:150px;margin:0"><small class="muted">Total pelanggan</small><h2 id="customerStatTotal" style="margin:6px 0 0">—</h2></div>
      <div class="panel" style="flex:1;min-width:150px;margin:0"><small class="muted">Akun terdaftar</small><h2 id="customerStatAccounts" style="margin:6px 0 0">—</h2></div>
      <div class="panel" style="flex:1;min-width:150px;margin:0"><small class="muted">Pernah bertransaksi</small><h2 id="customerStatOrders" style="margin:6px 0 0">—</h2></div>
    </div>
    <div class="panel" style="margin:0 0 16px">
      <h2 style="font-size:17px;margin:0 0 8px">Import & Export Database</h2>
      <p class="muted">Gunakan CSV UTF-8 dengan kolom wajib <strong>email</strong> dan <strong>nama</strong>. Kolom opsional: telepon, alamat, catatan. Import memperbarui kontak berdasarkan email yang sama.</p>
      <div class="row" style="gap:10px;align-items:end;flex-wrap:wrap">
        <label style="flex:2;min-width:220px">Pilih file CSV<input id="customerCsvFile" type="file" accept=".csv,text/csv" style="width:100%"></label>
        <button class="btn primary" id="customerImportBtn" type="button">Import CSV</button>
        <button class="btn" id="customerExportBtn" type="button">Export CSV</button>
        <button class="btn" id="customerTemplateBtn" type="button">Unduh Template</button>
      </div>
      <small class="muted">Import hanya menambahkan/memperbarui data kontak CRM. Import tidak membuat akun login, tidak mengubah password, dan tidak memberi izin email/push marketing.</small>
    </div>
    <div class="panel" style="margin:0">
      <div class="row" style="justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap">
        <h2 style="font-size:17px;margin:0">Daftar pelanggan</h2>
        <label style="min-width:240px;flex:1;max-width:420px">Cari pelanggan<input id="customerDbSearch" type="search" placeholder="Nama, email, atau nomor telepon" style="width:100%"></label>
        <label>Filter
          <select id="customerDbFilter">
            <option value="all">Semua pelanggan</option>
            <option value="account">Akun terdaftar</option>
            <option value="order">Pernah bertransaksi</option>
            <option value="import">Kontak hasil import</option>
          </select>
        </label>
      </div>
      <div id="customerDbTable" class="table-wrap" style="margin-top:14px"></div>
    </div>`;
  $("adminView").append(panel);
  $("customerDbRefresh").addEventListener("click", loadCustomers);
  $("customerDbSearch").addEventListener("input", render);
  $("customerDbFilter").addEventListener("change", render);
  $("customerImportBtn").addEventListener("click", importCsv);
  $("customerExportBtn").addEventListener("click", exportCsv);
  $("customerTemplateBtn").addEventListener("click", downloadTemplate);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field); field = "";
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");
  row.push(field);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV harus memiliki header dan minimal satu baris data.");
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, "").trim().toLowerCase());
  return rows.map((values, index) => Object.fromEntries(headers.map((header, col) => [header, (values[col] ?? "").trim()])))
    .filter(record => Object.values(record).some(Boolean));
}

function normalizeRecord(record, rowNumber) {
  const email = String(record.email || "").trim().toLowerCase();
  const name = String(record.nama || record.name || record.customer_name || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email tidak valid pada baris " + rowNumber + ".");
  if (name.length < 2 || name.length > 120) throw new Error("Nama wajib 2–120 karakter pada baris " + rowNumber + ".");
  const phone = String(record.telepon || record.phone || "").trim();
  const address = String(record.alamat || record.address || "").trim();
  const notes = String(record.catatan || record.notes || "").trim();
  if (phone.length > 32 || address.length > 1000 || notes.length > 2000) throw new Error("Data terlalu panjang pada baris " + rowNumber + ".");
  return { email, customer_name: name, phone, address, notes, source: "import", updated_at: new Date().toISOString() };
}

function csvCell(value) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}
function downloadCsv(filename, rows) {
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  downloadCsv("template-database-pelanggan-bospangan.csv", [
    ["email","nama","telepon","alamat","catatan"],
    ["pelanggan@example.com","Nama Pelanggan","081234567890","Alamat pelanggan","Catatan internal"]
  ]);
}

async function importCsv() {
  const file = $("customerCsvFile").files?.[0];
  if (!file) return status("Pilih file CSV terlebih dahulu.", true);
  if (!file.name.toLowerCase().endsWith(".csv") || file.size > 2 * 1024 * 1024) {
    return status("File harus berformat CSV dan maksimal 2 MB.", true);
  }
  const button = $("customerImportBtn");
  button.disabled = true;
  try {
    const records = parseCsv(await file.text());
    if (records.length > 5000) throw new Error("Maksimal 5.000 baris per proses import.");
    const headers = Object.keys(records[0] || {});
    if (!headers.includes("email") || !headers.some(key => ["nama","name","customer_name"].includes(key))) {
      throw new Error("Header wajib: email dan nama (atau name). Unduh template untuk contoh format.");
    }
    const unique = new Map();
    records.forEach((record, index) => {
      const item = normalizeRecord(record, index + 2);
      unique.set(item.email, item);
    });
    const payload = [...unique.values()];
    const approved = confirm("Import " + payload.length + " kontak unik? Kontak dengan email sama akan diperbarui. Izin marketing tidak akan diaktifkan.");
    if (!approved) return;
    let count = 0;
    for (let i = 0; i < payload.length; i += 250) {
      const { error } = await db.from("customer_directory").upsert(payload.slice(i, i + 250), { onConflict: "email" });
      if (error) throw error;
      count += payload.slice(i, i + 250).length;
    }
    $("customerCsvFile").value = "";
    await loadCustomers();
    status("Import berhasil. " + count + " kontak diproses; duplikat email digabung berdasarkan email.");
  } catch (error) {
    status("Import gagal: " + (error?.message || error), true);
  } finally {
    button.disabled = false;
  }
}

function exportCsv() {
  const rows = [
    ["email","nama","telepon","alamat","catatan","sumber","akun_terdaftar","jumlah_pesanan","total_transaksi","pesanan_terakhir"],
    ...customers.map(c => [
      c.email, c.customer_name, c.phone, c.address, c.notes, c.source,
      c.has_account ? "Ya" : "Tidak", c.order_count, c.total_spent,
      c.last_order_at ? new Date(c.last_order_at).toISOString() : ""
    ])
  ];
  downloadCsv("database-pelanggan-bospangan-" + new Date().toISOString().slice(0,10) + ".csv", rows);
  status("Export selesai. " + customers.length + " kontak diunduh sebagai CSV.");
}

function render() {
  const query = ($("customerDbSearch")?.value || "").trim().toLowerCase();
  const filter = $("customerDbFilter")?.value || "all";
  const visible = customers.filter(c => {
    const haystack = [c.email,c.customer_name,c.phone,c.address].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (filter === "account" && !c.has_account) return false;
    if (filter === "order" && !c.order_count) return false;
    if (filter === "import" && c.source !== "import") return false;
    return true;
  });
  $("customerStatTotal").textContent = customers.length.toLocaleString("id-ID");
  $("customerStatAccounts").textContent = customers.filter(c => c.has_account).length.toLocaleString("id-ID");
  $("customerStatOrders").textContent = customers.filter(c => c.order_count > 0).length.toLocaleString("id-ID");
  const root = $("customerDbTable");
  if (!visible.length) {
    root.innerHTML = '<p class="muted">Belum ada pelanggan yang sesuai. Pelanggan akan masuk otomatis setelah transaksi atau dapat ditambahkan melalui Import CSV.</p>';
    return;
  }
  root.innerHTML = '<table><thead><tr><th>Pelanggan</th><th>Kontak</th><th>Sumber</th><th>Pesanan</th><th>Total transaksi</th><th>Terakhir transaksi</th></tr></thead><tbody>' +
    visible.map(c => '<tr><td><strong>' + esc(c.customer_name || "—") + '</strong><br><small>' + esc(c.email) + '</small></td>' +
      '<td>' + esc(c.phone || "—") + '<br><small>' + esc(c.address || "") + '</small></td>' +
      '<td>' + (c.has_account ? '<span class="badge">Akun</span> ' : '') + esc(c.source_label) + '</td>' +
      '<td>' + Number(c.order_count || 0).toLocaleString("id-ID") + '</td><td>' + money(c.total_spent) + '</td>' +
      '<td>' + (c.last_order_at ? esc(new Date(c.last_order_at).toLocaleDateString("id-ID")) : "—") + '</td></tr>').join("") +
    '</tbody></table><p class="muted" style="margin-top:10px">Menampilkan ' + visible.length.toLocaleString("id-ID") + ' dari ' + customers.length.toLocaleString("id-ID") + ' kontak.</p>';
}

async function loadCustomers() {
  status("Mengambil data pelanggan, akun, dan transaksi...");
  const [directoryResult, profileResult, orderResult] = await Promise.all([
    db.from("customer_directory").select("email,customer_name,phone,address,notes,source,first_seen_at,last_seen_at,created_at").order("updated_at", { ascending: false }).limit(10000),
    db.from("profiles").select("id,email,display_name,role,created_at").eq("role", "customer").limit(10000),
    db.from("orders").select("customer_email,customer_name,customer_phone,customer_address,total,created_at,status").neq("status", "cancelled").limit(20000)
  ]);
  for (const result of [directoryResult, profileResult, orderResult]) {
    if (result.error) throw result.error;
  }
  const map = new Map();
  (directoryResult.data || []).forEach(row => {
    const email = String(row.email || "").toLowerCase();
    if (email) map.set(email, {
      email, customer_name: row.customer_name || "", phone: row.phone || "", address: row.address || "",
      notes: row.notes || "", source: row.source || "order", has_account: false,
      order_count: 0, total_spent: 0, last_order_at: null
    });
  });
  (profileResult.data || []).forEach(row => {
    const email = String(row.email || "").toLowerCase();
    if (!email) return;
    const current = map.get(email) || {
      email, customer_name: "", phone: "", address: "", notes: "", source: "account",
      has_account: false, order_count: 0, total_spent: 0, last_order_at: null
    };
    current.has_account = true;
    if (!current.customer_name) current.customer_name = row.display_name || "";
    current.source = current.source === "order" ? "order" : "account";
    map.set(email, current);
  });
  (orderResult.data || []).forEach(order => {
    const email = String(order.customer_email || "").toLowerCase();
    if (!email) return;
    const current = map.get(email) || {
      email, customer_name: "", phone: "", address: "", notes: "", source: "order",
      has_account: false, order_count: 0, total_spent: 0, last_order_at: null
    };
    current.order_count += 1;
    current.total_spent += Number(order.total || 0);
    if (!current.last_order_at || new Date(order.created_at) > new Date(current.last_order_at)) {
      current.last_order_at = order.created_at;
      current.customer_name = current.customer_name || order.customer_name || "";
      current.phone = current.phone || order.customer_phone || "";
      current.address = current.address || order.customer_address || "";
    }
    map.set(email, current);
  });
  customers = [...map.values()].map(c => ({
    ...c,
    source_label: c.source === "import" ? "Import CSV" : c.source === "account" ? "Akun pelanggan" : c.has_account ? "Akun + transaksi" : "Transaksi"
  })).sort((a,b) => a.customer_name.localeCompare(b.customer_name, "id"));
  render();
  status("Database siap: " + customers.length.toLocaleString("id-ID") + " kontak berhasil dimuat.");
}

async function initialize() {
  mount();
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("Sesi admin tidak ditemukan. Silakan login kembali.");
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", session.user.id).single();
  if (error) throw error;
  if (!["admin", "super_admin"].includes(profile?.role)) throw new Error("Akses ditolak. Modul ini hanya untuk Admin dan Super Admin.");
  await loadCustomers();
  initialized = true;
}

window.addEventListener("cms:customers-open", async () => {
  mount();
  $("customerDatabasePanel").classList.remove("hidden");
  try {
    if (!initialized) await initialize();
    else await loadCustomers();
    $("customerDatabasePanel").classList.remove("hidden");
  } catch (error) {
    status("Modul pelanggan gagal dimuat: " + (error?.message || error) + ". Pastikan migration supabase/customer-directory.sql sudah dijalankan.", true);
  }
});
