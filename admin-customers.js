import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
      <p class="muted">Import file Excel <strong>.xlsx / .xls</strong> atau CSV. <strong>Nama wajib</strong>; email boleh kosong jika nomor telepon tersedia. Kontak dicocokkan berdasarkan email, atau nomor telepon jika email tidak tersedia. Kontak yang cocok diperbarui, bukan digandakan.</p>
      <div class="row" style="gap:10px;align-items:end;flex-wrap:wrap">
        <label style="flex:2;min-width:240px">Pilih file Excel / CSV<input id="customerCsvFile" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" style="width:100%"></label>
        <button class="btn primary" id="customerImportBtn" type="button">Import Excel / CSV</button>
        <button class="btn" id="customerExportBtn" type="button">Export Excel</button>
        <button class="btn" id="customerTemplateBtn" type="button">Unduh Template Excel</button>
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
  $("customerExportBtn").addEventListener("click", exportExcel);
  $("customerTemplateBtn").addEventListener("click", downloadExcelTemplate);
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
  const rawEmail = String(record.email || "").trim().toLowerCase();
  const email = rawEmail || null;
  const importedName = [record.first_name, record.last_name].filter(Boolean).join(" ").trim();
  const name = String(record.nama || record.name || record.customer_name || importedName || record.perusahaan || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email tidak valid pada baris " + rowNumber + ".");
  if (name.length < 2 || name.length > 120) throw new Error("Nama wajib 2–120 karakter pada baris " + rowNumber + ".");
  const phone = String(record.telepon || record.telepon_perusahaan || record.mobile_phone_number || record.whatsapp_phone_number || record.phone || "").trim();
  const phoneDigits = phone.replace(/\D/g, "");
  if (!email && phoneDigits.length < 8) throw new Error("Email atau nomor telepon minimal 8 digit wajib diisi pada baris " + rowNumber + ".");
  const cityCountry = [record.kota, record.negara].filter(Boolean).join(", ");
  const address = String(record.alamat || record.address || cityCountry).trim();
  const importedNotes = [
    record.perusahaan ? "Perusahaan: " + record.perusahaan : "",
    record.status_lead ? "Lead status: " + record.status_lead : "",
    record.status_marketing ? "Marketing contact status: " + record.status_marketing : "",
    record.pemilik_kontak ? "Contact owner: " + record.pemilik_kontak : "",
    record.industri ? "Industri: " + record.industri : "",
    record.tanggal_dibuat ? "Tanggal dibuat: " + record.tanggal_dibuat : "",
    record.marketing_contact_status ? "Marketing contact status: " + record.marketing_contact_status : "",
    record.message ? "Pesan: " + record.message : "",
    record.boleh_blast_whatsapp ? "Boleh Blast Whatsapp: " + record.boleh_blast_whatsapp : ""
  ].filter(Boolean).join(" | ");
  const notes = [String(record.catatan || record.notes || "").trim(), importedNotes].filter(Boolean).join(" | ");
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

function normalizeHeader(value) {
  const key = String(value ?? "").replace(String.fromCharCode(0xFEFF), "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s./-]+/g, "_").replace(/^_+|_+$/g, "");
  const aliases = {
    email: "email", e_mail: "email", alamat_email: "email",
    nama: "nama", name: "nama", customer_name: "nama", nama_pelanggan: "nama",
    first_name: "first_name", firstname: "first_name", last_name: "last_name", lastname: "last_name",
    telepon: "telepon", phone: "telepon", no_hp: "telepon", nomor_telepon: "telepon",
    phone_number: "telepon", phone_number_1: "telepon_perusahaan", mobile_phone_number: "mobile_phone_number", whatsapp_phone_number: "whatsapp_phone_number",
    alamat: "alamat", address: "alamat", city: "kota", country_region: "negara",
    company_name: "perusahaan", lead_status: "status_lead",
    marketing_contact_status: "status_marketing", contact_owner: "pemilik_kontak",
    industry: "industri", create_date: "tanggal_dibuat", record_id: "record_id"
  };
  return aliases[key] || key;
}

async function readImportFile(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const records = parseCsv(await file.text());
    return records.map(record => Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeader(key), value])
    ));
  }
  if (extension !== "xlsx" && extension !== "xls") {
    throw new Error("Format tidak didukung. Gunakan file .xlsx, .xls, atau .csv.");
  }
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("File Excel tidak memiliki worksheet.");
  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: false });
  if (!matrix.length) throw new Error("Worksheet Excel kosong atau tidak memiliki baris data.");

  const hasEmailHeader = row => row.some(cell => normalizeHeader(cell) === "email");
  const headerIndex = matrix.findIndex(row =>
    hasEmailHeader(row) && row.some(cell => ["first_name", "last_name", "nama", "name"].includes(normalizeHeader(cell)))
  );

  if (headerIndex >= 0) {
    const headers = matrix[headerIndex].map(normalizeHeader);
    return matrix.slice(headerIndex + 1).map(row => Object.fromEntries(
      headers.map((key, index) => [key, String(row[index] ?? "").trim()])
    )).filter(record => Object.values(record).some(Boolean));
  }

  // HubSpot "Readable Version" split files omit the column header row.
  // Their 23-column layout follows the standard HubSpot export order.
  const hubSpotTitle = String(matrix[0]?.[0] ?? "").trim().toLowerCase();
  if (hubSpotTitle.includes("hubspot contacts export")) {
    const headers = [
      "record_id", "first_name", "last_name", "email", "phone_number",
      "company_name", "lead_status", "marketing_contact_status", "create_date",
      "contact_owner", "last_activity_date", "contact_second_owner",
      "mobile_phone_number", "whatsapp_phone_number", "fax_number",
      "terakhir_di_blast", "message", "boleh_blast_whatsapp", "email_domain",
      "associated_company", "primary_associated_company_id",
      "associated_company_1", "associated_company_ids"
    ].map(normalizeHeader);
    return matrix.slice(1).map(row => Object.fromEntries(
      headers.map((key, index) => [key, String(row[index] ?? "").trim()])
    )).filter(record => Object.values(record).some(Boolean));
  }

  throw new Error("Header kolom tidak ditemukan. Pastikan file memiliki kolom Email dan First Name/Last Name, atau berasal dari ekspor HubSpot Contacts.");
}

function downloadExcel(filename, rows, sheetName = "Pelanggan") {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0].map((_, index) => ({
    wch: Math.min(40, Math.max(14, ...rows.slice(0, 100).map(row => String(row[index] ?? "").length + 2)))
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename, { compression: true });
}

function downloadExcelTemplate() {
  downloadExcel("template-database-pelanggan-bospangan.xlsx", [
    ["email","nama","telepon","alamat","catatan"],
    ["","Nama Pelanggan","081234567890","Alamat pelanggan","Email boleh kosong jika nomor telepon tersedia"]
  ], "Template Import");
}

async function importCsv() {
  const file = $("customerCsvFile").files?.[0];
  if (!file) return status("Pilih file Excel atau CSV terlebih dahulu.", true);
  const extension = file.name.toLowerCase().split(".").pop();
  const maxSize = extension === "csv" ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!["csv","xlsx","xls"].includes(extension) || file.size > maxSize) {
    return status("Gunakan .xlsx/.xls maksimal 10 MB atau .csv maksimal 2 MB.", true);
  }
  const button = $("customerImportBtn");
  button.disabled = true;
  try {
    const records = await readImportFile(file);
    if (records.length > 5000) throw new Error("Maksimal 5.000 baris per proses import.");
    if (!records.length) throw new Error("Tidak ada data pelanggan pada file.");
    const headers = Object.keys(records[0] || {});
    const hasNameColumn = headers.some(key => ["nama","name","customer_name","first_name","last_name","perusahaan"].includes(key));
    const hasPhoneColumn = headers.some(key => ["telepon","telepon_perusahaan","mobile_phone_number","whatsapp_phone_number"].includes(key));
    if (!hasNameColumn || (!headers.includes("email") && !hasPhoneColumn)) {
      throw new Error("Kolom wajib: Nama dan minimal salah satu kolom Email atau Nomor Telepon.");
    }
    const unique = new Map();
    let duplicateInFile = 0;
    let skippedInvalid = 0;
    const failedRows = [];
    records.forEach((record, index) => {
      try {
        const item = normalizeRecord(record, index + 2);
        const identity = item.email ? "email:" + item.email : "phone:" + item.phone.replace(/\D/g, "");
        if (unique.has(identity)) duplicateInFile++;
        unique.set(identity, item);
      } catch (error) {
        skippedInvalid++;
        failedRows.push({ row: index + 2, reason: error.message || "Data tidak valid." });
      }
    });
    const payload = [...unique.values()];
    if (!payload.length) throw new Error("Tidak ada kontak valid. Setiap baris harus memiliki nama dan email atau nomor telepon minimal 8 digit.");
    const approved = confirm("Import " + payload.length + " kontak unik dari " + file.name + "? Kontak dicocokkan berdasarkan email atau nomor telepon dan data yang cocok akan diperbarui. Izin marketing tidak akan diaktifkan.");
    if (!approved) return;
    let inserted = 0, updated = 0, rejected = 0;
    for (let i = 0; i < payload.length; i += 250) {
      const { data, error } = await db.rpc("import_customer_directory_contacts", {
        p_contacts: payload.slice(i, i + 250)
      });
      if (error) throw error;
      inserted += Number(data?.inserted || 0);
      updated += Number(data?.updated || 0);
      rejected += Number(data?.invalid || 0);
      (data?.invalid_rows || []).forEach(item => failedRows.push({
        row: "Batch " + (Math.floor(i / 250) + 1) + " / data ke-" + item.row,
        reason: item.reason || "Ditolak oleh database."
      }));
    }
    $("customerCsvFile").value = "";
    await loadCustomers();
    if (failedRows.length) {
      downloadExcel("laporan-baris-gagal-" + new Date().toISOString().slice(0,10) + ".xlsx", [
        ["Baris sumber / referensi","Alasan gagal"],
        ...failedRows.map(item => [item.row, item.reason])
      ], "Baris Gagal");
    }
    status("Import selesai: " + inserted + " kontak baru, " + updated + " diperbarui, " + duplicateInFile + " duplikat dalam file, dan " + (skippedInvalid + rejected) + " baris gagal. " + (failedRows.length ? "Laporan baris gagal telah diunduh. " : "") + "File: " + file.name + ".");
  } catch (error) {
    status("Import gagal: " + (error?.message || error), true);
  } finally {
    button.disabled = false;
  }
}

function exportExcel() {
  const rows = [
    ["email","nama","telepon","alamat","catatan","sumber","akun_terdaftar","jumlah_pesanan","total_transaksi","pesanan_terakhir"],
    ...customers.map(c => [
      c.email, c.customer_name, c.phone, c.address, c.notes, c.source,
      c.has_account ? "Ya" : "Tidak", c.order_count, c.total_spent,
      c.last_order_at ? new Date(c.last_order_at).toISOString() : ""
    ])
  ];
  downloadExcel("database-pelanggan-bospangan-" + new Date().toISOString().slice(0,10) + ".xlsx", rows);
  status("Export Excel selesai. " + customers.length + " kontak diunduh.");
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
    visible.map(c => '<tr><td><strong>' + esc(c.customer_name || "—") + '</strong><br><small>' + esc(c.email || "Tanpa email") + '</small></td>' +
      '<td>' + esc(c.phone || "—") + '<br><small>' + esc(c.address || "") + '</small></td>' +
      '<td>' + (c.has_account ? '<span class="badge">Akun</span> ' : '') + esc(c.source_label) + '</td>' +
      '<td>' + Number(c.order_count || 0).toLocaleString("id-ID") + '</td><td>' + money(c.total_spent) + '</td>' +
      '<td>' + (c.last_order_at ? esc(new Date(c.last_order_at).toLocaleDateString("id-ID")) : "—") + '</td></tr>').join("") +
    '</tbody></table><p class="muted" style="margin-top:10px">Menampilkan ' + visible.length.toLocaleString("id-ID") + ' dari ' + customers.length.toLocaleString("id-ID") + ' kontak.</p>';
}

async function fetchAllCustomerRows(queryFactory, pageSize = 500) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadCustomers() {
  status("Mengambil seluruh data pelanggan, akun, dan transaksi...");
  const [directoryRows, profileRows, orderRows] = await Promise.all([
    fetchAllCustomerRows(() => db.from("customer_directory")
      .select("email,customer_name,phone,address,notes,source,first_seen_at,last_seen_at,created_at")
      .order("updated_at", { ascending: false }).order("email", { ascending: true })),
    fetchAllCustomerRows(() => db.from("profiles")
      .select("id,email,display_name,role,created_at").eq("role", "customer")
      .order("created_at", { ascending: true }).order("email", { ascending: true })),
    fetchAllCustomerRows(() => db.from("orders")
      .select("customer_email,customer_name,customer_phone,customer_address,total,created_at,status")
      .neq("status", "cancelled").order("created_at", { ascending: true }).order("customer_email", { ascending: true }))
  ]);
  const map = new Map();
  (directoryRows || []).forEach(row => {
    const email = String(row.email || "").toLowerCase();
    const phone = String(row.phone || "");
    const key = email ? "email:" + email : "phone:" + phone.replace(/\D/g, "");
    if (email || phone.replace(/\D/g, "").length >= 8) map.set(key, {
      email, customer_name: row.customer_name || "", phone, address: row.address || "",
      notes: row.notes || "", source: row.source || "order", has_account: false,
      order_count: 0, total_spent: 0, last_order_at: null
    });
  });
  (profileRows || []).forEach(row => {
    const email = String(row.email || "").toLowerCase();
    if (!email) return;
    const current = map.get("email:" + email) || {
      email, customer_name: "", phone: "", address: "", notes: "", source: "account",
      has_account: false, order_count: 0, total_spent: 0, last_order_at: null
    };
    current.has_account = true;
    if (!current.customer_name) current.customer_name = row.display_name || "";
    current.source = current.source === "order" ? "order" : "account";
    map.set("email:" + email, current);
  });
  (orderRows || []).forEach(order => {
    const email = String(order.customer_email || "").toLowerCase();
    if (!email) return;
    const current = map.get("email:" + email) || {
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
    map.set("email:" + email, current);
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
