import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const money = value => "Rp" + Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
let orders = [];
let activeOrder = null;
let initialized = false;

function setStatus(message, error = false) {
  const node = $("invoiceStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = error ? "#b42318" : "#17633f";
}

function mountPanel() {
  if ($("invoiceAdminPanel")) return;
  const panel = document.createElement("section");
  panel.id = "invoiceAdminPanel";
  panel.className = "panel hidden";
  panel.innerHTML = `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px">
      <div>
        <h1 class="page-title">Invoice</h1>
        <p class="page-subtitle">Buat, tinjau, dan cetak invoice berdasarkan pesanan Bos Pangan.</p>
      </div>
      <button class="btn" id="invoiceRefresh" type="button">Muat Ulang</button>
    </div>
    <p id="invoiceStatus" class="status" role="status" aria-live="polite">Memuat data pesanan...</p>
    <div class="panel" style="margin:0 0 16px">
      <div class="row" style="align-items:end;gap:12px">
        <label style="flex:2;min-width:220px">Cari pesanan
          <input id="invoiceSearch" type="search" placeholder="Nomor pesanan, nama, atau email pelanggan" style="width:100%">
        </label>
        <label style="flex:1;min-width:170px">Status invoice
          <select id="invoiceFilter" style="width:100%">
            <option value="eligible">Siap dibuatkan invoice</option>
            <option value="all">Semua pesanan</option>
            <option value="unpaid">Belum dibayar</option>
            <option value="paid">Sudah dibayar</option>
          </select>
        </label>
      </div>
    </div>
    <div class="panel" style="margin:0 0 18px">
      <h2 style="font-size:17px;margin:0 0 12px">Daftar pesanan</h2>
      <div id="invoiceOrdersTable" class="table-wrap"></div>
    </div>
    <div id="invoicePreview" class="panel hidden" style="margin:0">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0">Pratinjau invoice</h2>
        <div class="row" style="gap:8px">
          <button class="btn" id="invoiceClosePreview" type="button">Tutup</button>
          <button class="btn primary" id="invoicePrint" type="button">Cetak / Simpan PDF</button>
        </div>
      </div>
      <div id="invoiceDocument"></div>
    </div>`;
  $("adminView").append(panel);
  $("invoiceRefresh").addEventListener("click", loadOrders);
  $("invoiceSearch").addEventListener("input", renderOrders);
  $("invoiceFilter").addEventListener("change", renderOrders);
  $("invoiceClosePreview").addEventListener("click", () => {
    $("invoicePreview").classList.add("hidden");
    activeOrder = null;
  });
  $("invoicePrint").addEventListener("click", printInvoice);
}

function canIssueInvoice(order) {
  if (order.status === "cancelled") return false;
  if (order.transaction_type === "special" && order.status === "quoted") return false;
  return true;
}

function invoiceNumber(order) {
  return "INV-" + String(order.order_number || "").replace(/^BOS-/, "");
}

function renderOrders() {
  const root = $("invoiceOrdersTable");
  if (!root) return;
  const query = ($("invoiceSearch").value || "").trim().toLowerCase();
  const filter = $("invoiceFilter").value;
  const visible = orders.filter(order => {
    const haystack = [order.order_number, order.customer_name, order.customer_email].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (filter === "eligible" && !canIssueInvoice(order)) return false;
    if (filter === "unpaid" && order.payment_status !== "unpaid") return false;
    if (filter === "paid" && order.payment_status !== "paid") return false;
    return true;
  });

  if (!visible.length) {
    root.innerHTML = '<p class="muted">Tidak ada pesanan yang sesuai dengan filter.</p>';
    return;
  }
  root.innerHTML = '<table><thead><tr><th>No. Pesanan</th><th>Pelanggan</th><th>Tanggal</th><th>Total</th><th>Status</th><th>Invoice</th><th>Aksi</th></tr></thead><tbody>' +
    visible.map(order => {
      const eligible = canIssueInvoice(order);
      const label = order.status === "cancelled" ? "Dibatalkan" :
        order.transaction_type === "special" && order.status === "quoted" ? "Menunggu konfirmasi penawaran" :
        "Siap dibuat";
      return '<tr><td><strong>' + esc(order.order_number) + '</strong><br><small>' + esc(order.transaction_type === "special" ? "Transaksi khusus" : "Reguler") + '</small></td>' +
        '<td>' + esc(order.customer_name) + '<br><small>' + esc(order.customer_email) + '</small></td>' +
        '<td>' + esc(new Date(order.created_at).toLocaleDateString("id-ID")) + '</td>' +
        '<td>' + money(order.total) + '</td>' +
        '<td>' + esc(order.status) + ' / ' + esc(order.payment_status) + '</td>' +
        '<td>' + (eligible ? esc(invoiceNumber(order)) : '<small>' + label + '</small>') + '</td>' +
        '<td>' + (eligible ? '<button class="btn" type="button" data-invoice-preview="' + esc(order.id) + '">Buat / Lihat</button>' : '<small>—</small>') + '</td></tr>';
    }).join("") + '</tbody></table>';

  root.querySelectorAll("[data-invoice-preview]").forEach(button => {
    button.addEventListener("click", () => showInvoice(orders.find(order => order.id === button.dataset.invoicePreview)));
  });
}

function invoiceMarkup(order) {
  const items = order.order_items || [];
  const rows = items.map((item, index) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const subtotal = Number(item.line_subtotal ?? qty * price);
    const tax = Number(item.tax_amount || 0);
    return '<tr><td>' + (index + 1) + '</td><td><strong>' + esc(item.product_name_snapshot) + '</strong><br><small>SKU: ' + esc(item.sku_snapshot) + '</small></td>' +
      '<td class="num">' + qty.toLocaleString("id-ID") + '</td><td class="num">' + money(price) + '</td><td class="num">' + money(subtotal) + '</td><td class="num">' + money(tax) + '</td></tr>';
  }).join("");
  const date = new Date(order.created_at);
  const taxLabel = Number(order.tax_percent || 0).toLocaleString("id-ID") + "%";
  return '<article class="bp-invoice">' +
    '<header class="bp-invoice-head"><div><div class="bp-brand">BOS PANGAN</div><div class="bp-muted">Juara Pangan Lokal</div></div><div class="bp-invoice-title"><h1>INVOICE</h1><strong>' + esc(invoiceNumber(order)) + '</strong></div></header>' +
    '<div class="bp-invoice-meta"><div><span class="bp-label">DITERBITKAN KEPADA</span><strong>' + esc(order.customer_name) + '</strong><span>' + esc(order.customer_email) + '</span><span>' + esc(order.customer_phone) + '</span><span>' + esc(order.customer_address || "Alamat tidak dicantumkan") + '</span></div>' +
    '<div><span class="bp-label">INFORMASI INVOICE</span><span>No. Pesanan: <strong>' + esc(order.order_number) + '</strong></span><span>Tanggal: ' + esc(date.toLocaleDateString("id-ID")) + '</span><span>Jenis: ' + esc(order.transaction_type === "special" ? "Transaksi khusus" : "Reguler") + '</span><span>Status pembayaran: <strong>' + esc(order.payment_status === "paid" ? "LUNAS" : order.payment_status.toUpperCase()) + '</strong></span></div></div>' +
    '<table class="bp-invoice-table"><thead><tr><th>No.</th><th>Deskripsi produk</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th><th class="num">Pajak</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="6">Rincian produk tidak tersedia.</td></tr>') + '</tbody></table>' +
    '<div class="bp-invoice-summary"><div><span>Subtotal</span><strong>' + money(order.subtotal) + '</strong></div><div><span>Pajak (' + taxLabel + ')</span><strong>' + money(order.tax_amount) + '</strong></div><div class="bp-grand-total"><span>Total tagihan</span><strong>' + money(order.total) + '</strong></div></div>' +
    (order.special_request ? '<div class="bp-invoice-note"><strong>Catatan transaksi:</strong> ' + esc(order.special_request) + '</div>' : '') +
    '<footer class="bp-invoice-footer">Terima kasih telah bertransaksi dengan Bos Pangan.</footer></article>';
}

function showInvoice(order) {
  if (!order || !canIssueInvoice(order)) return;
  activeOrder = order;
  $("invoiceDocument").innerHTML = invoiceMarkup(order);
  $("invoicePreview").classList.remove("hidden");
  $("invoicePreview").scrollIntoView({ behavior: "smooth", block: "start" });
}

function printInvoice() {
  if (!activeOrder) return;
  const content = invoiceMarkup(activeOrder);
  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) {
    setStatus("Jendela cetak diblokir browser. Izinkan pop-up untuk bospangan.com lalu coba lagi.", true);
    return;
  }
  printWindow.document.open();
  printWindow.onload = () => printWindow.print();
  printWindow.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(invoiceNumber(activeOrder))} - Bos Pangan</title><style>
    *{box-sizing:border-box}body{margin:0;padding:32px;background:#f3f5f7;color:#253047;font:14px/1.5 Arial,sans-serif}.bp-invoice{max-width:900px;margin:0 auto;background:#fff;padding:44px;border:1px solid #e5e9ef}.bp-invoice-head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #0d461a;padding-bottom:22px}.bp-brand{font-size:25px;font-weight:800;letter-spacing:3px;color:#0d461a}.bp-muted{color:#7b8797}.bp-invoice-title{text-align:right}.bp-invoice-title h1{margin:0 0 4px;font-size:30px;letter-spacing:2px}.bp-invoice-title strong{color:#0d461a}.bp-invoice-meta{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:28px 0}.bp-invoice-meta>div{display:flex;flex-direction:column;gap:4px}.bp-label{font-size:10px;letter-spacing:1px;color:#8993a3;font-weight:700;margin-bottom:8px}.bp-invoice-table{width:100%;border-collapse:collapse;margin:22px 0}.bp-invoice-table th,.bp-invoice-table td{padding:11px 9px;border-bottom:1px solid #e8edf2;text-align:left;vertical-align:top}.bp-invoice-table th{background:#f4f7f4;font-size:11px;color:#596779}.bp-invoice-table .num{text-align:right;white-space:nowrap}.bp-invoice-summary{width:min(100%,360px);margin:20px 0 20px auto}.bp-invoice-summary>div{display:flex;justify-content:space-between;gap:20px;padding:8px 0;border-bottom:1px solid #edf0f3}.bp-grand-total{font-size:18px;font-weight:800;color:#0d461a;border-bottom:0!important;border-top:2px solid #0d461a}.bp-invoice-note{padding:12px;background:#f7f9fb;border-radius:6px}.bp-invoice-footer{text-align:center;border-top:1px solid #e5e9ef;margin-top:32px;padding-top:18px;color:#667386}.bp-invoice-table small{color:#8490a0}@media print{body{padding:0;background:#fff}.bp-invoice{max-width:none;border:0;padding:0}@page{size:A4;margin:15mm}}@media(max-width:650px){body{padding:12px}.bp-invoice{padding:20px}.bp-invoice-meta{grid-template-columns:1fr}}
  </style></head><body>${content}</body></html>`);
  printWindow.document.close();
}

async function loadOrders() {
  setStatus("Memuat pesanan dari database...");
  const { data, error } = await db.from("orders")
    .select("id,order_number,customer_name,customer_email,customer_phone,customer_address,transaction_type,total,subtotal,tax_percent,tax_amount,status,payment_status,created_at,special_request,order_items(sku_snapshot,product_name_snapshot,quantity,unit_price,line_subtotal,tax_percent,tax_amount)")
    .order("created_at", { ascending: false }).limit(200);
  if (error) {
    setStatus("Gagal memuat pesanan: " + error.message, true);
    return;
  }
  orders = data || [];
  renderOrders();
  setStatus(orders.length + " pesanan berhasil dimuat. Invoice menggunakan snapshot transaksi saat checkout.");
}

async function initialize() {
  mountPanel();
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    setStatus("Sesi admin tidak ditemukan. Silakan login kembali.", true);
    return;
  }
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", session.user.id).single();
  if (error) throw error;
  if (!["admin", "super_admin"].includes(profile?.role)) {
    setStatus("Akses ditolak. Hanya Admin dan Super Admin yang dapat membuat invoice.", true);
    return;
  }
  await loadOrders();
  initialized = true;
}

window.addEventListener("cms:invoice-open", async () => {
  mountPanel();
  $("invoiceAdminPanel").classList.remove("hidden");
  if (!initialized) {
    try {
      await initialize();
      $("invoiceAdminPanel").classList.remove("hidden");
    } catch (error) {
      setStatus("Modul invoice gagal dimuat: " + (error?.message || "Kesalahan tidak diketahui"), true);
    }
  } else {
    await loadOrders();
  }
});
