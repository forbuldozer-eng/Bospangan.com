import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const status = message => { $("status").textContent = message; };

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  customer: "Pelanggan",
  none: "Belum diberi akses"
};

let currentUser = null;
let currentRole = null;
let currentPermissions = [];

const pageInfo = {
  news:["Berita / Blog","Kelola artikel dan publikasi Bos Pangan","Modul publikasi artikel belum dihubungkan ke database CMS."],
  pages:["Halaman Website","Kelola halaman informasi seperti Tentang Kami dan Kontak","Modul halaman statis memerlukan struktur konten dan workflow publikasi tersendiri."],
  feeds:["Feeds Timeline","Kelola konten timeline dan feed","Modul feeds belum memiliki tabel penyimpanan pada backend saat ini."],
  banner:["Banner Website","Kelola banner promosi yang tampil di website","Modul banner akan dihubungkan ke halaman utama setelah skema banner ditambahkan."],
  "category-order":["Urutan Kategori","Atur urutan kategori produk pada website","Atur posisi dan visibilitas kategori yang tampil pada halaman utama."],
  categories:["Kategori Produk","Kelola kategori katalog Bos Pangan","Kategori produk yang aktif saat ini mengikuti daftar kategori pada katalog. Pengelolaan dinamis memerlukan tabel kategori."],
  media:["Media & Galeri","Kelola foto dan video aset website","Pusat penyimpanan gambar dan video website Bos Pangan."],
  invoice:["Invoice","Dokumen transaksi dan tagihan pelanggan","Backend saat ini menyimpan pesanan dan rincian transaksi; pembuatan invoice PDF belum tersedia."],
  customers:["Pelanggan","Database pelanggan, kontak, dan riwayat transaksi","Kelola pelanggan dari akun terdaftar, transaksi, dan import CSV."],
  "transaction-report":["Laporan Transaksi","Ringkasan penjualan dan status pesanan","Laporan analitik belum dibuat. Data transaksi tersedia di menu Pesanan."],
  "product-report":["Laporan Produk","Ringkasan katalog dan inventori","Laporan stok dan performa produk belum dibuat. Data produk tersedia di menu Produk."],
  coupons:["Kupon & Voucher","Kelola kode promosi dan potongan harga","Sistem kupon belum tersedia pada backend saat ini."],
  notifications:["Log Notifikasi","Pantau email pemberitahuan pesanan dan campaign","Log notifikasi pesanan tersedia di bagian Campaign; buka menu Promosi Produk untuk melihatnya."]
};

function closeMobileMenu(){
  $("sidebar").classList.remove("open");
  $("scrim").classList.remove("show");
}
function showOnly(id){
  ["overviewView","placeholderView","articleView","transactionReportView","financialReportView","accessPanel","adminView"].forEach(key => $(key).classList.toggle("hidden", key !== id));
}
function activatePage(page){
  const activeLinks = document.querySelectorAll(".nav-link");
  activeLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page));
  const labels = {
    overview:"Dashboard",pages:"Landing Page",banner:"Banner Website",products:"Produk",orders:"Pesanan",special:"Transaksi Khusus",
    campaigns:"Promosi Produk","store-settings":"Pengaturan Toko",admins:"Admin & Hak Akses",
    notifications:"Log Notifikasi",affiliates:"Affiliate Management","financial-report":"Laporan Keuangan"
  };
  $("crumb").textContent = labels[page] || pageInfo[page]?.[0] || "Dashboard";
  closeMobileMenu();
  if (page !== "media") $("mediaAdminPanel")?.classList.add("hidden");
  if (page !== "invoice") $("invoiceAdminPanel")?.classList.add("hidden");
  if (page !== "customers") $("customerDatabasePanel")?.classList.add("hidden");

  if(page === "overview"){
    showOnly("overviewView");
    return;
  }
  if(page === "categories"){
    showOnly("adminView");
    $("commerceAdmin")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:categories-open"));
    return;
  }
  if(page === "category-order"){
    showOnly("adminView");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("commerceAdmin")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:category-order-open"));
    return;
  }
  if(page === "banner"){
    showOnly("adminView");
    // All CMS modules mount inside #adminView; show only the selected module.
    $("commerceAdmin")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:banner-open"));
    return;
  }
  if(page === "pages"){
    showOnly("adminView");
    $("commerceAdmin")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:landing-pages-open"));
    return;
  }
  if(page === "media"){
    showOnly("adminView");
    $("commerceAdmin")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("mediaAdminPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:media-open"));
    return;
  }
  if(page === "invoice"){
    showOnly("adminView");
    $("commerceAdmin")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("mediaAdminPanel")?.classList.add("hidden");
    $("invoiceAdminPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:invoice-open"));
    return;
  }
  if(page === "customers"){
    showOnly("adminView");
    $("commerceAdmin")?.classList.add("hidden");
    $("siteBannerPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("mediaAdminPanel")?.classList.add("hidden");
    $("invoiceAdminPanel")?.classList.add("hidden");
    $("customerDatabasePanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:customers-open"));
    return;
  }
  if(page === "news"){
    showOnly("articleView");
    window.dispatchEvent(new CustomEvent("cms:articles-open"));
    return;
  }
  if(page === "transaction-report"){
    showOnly("transactionReportView");
    window.dispatchEvent(new CustomEvent("cms:transaction-report-open"));
    return;
  }
  if(page === "financial-report"){
    showOnly("financialReportView");
    window.dispatchEvent(new CustomEvent("cms:financial-report-open"));
    return;
  }
  if(page === "admins"){
    if(currentRole !== "super_admin") return;
    showOnly("accessPanel");
    return;
  }

  if(page === "affiliates"){
    showOnly("adminView");
    document.querySelectorAll("#adminView > section").forEach(node=>node.classList.add("hidden"));
    document.getElementById("affiliateAdminPanel")?.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("cms:affiliate-open"));
    return;
  }

  const commerceTabs = {products:"products",orders:"orders",special:"orders",campaigns:"campaigns","store-settings":"settings",notifications:"campaigns"};
  if(commerceTabs[page]){
    showOnly("adminView");
    $("siteBannerPanel")?.classList.add("hidden");
    $("landingPagesPanel")?.classList.add("hidden");
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    $("commerceAdmin")?.classList.remove("hidden");
    const tab = document.querySelector('#commerceAdmin [data-tab="'+commerceTabs[page]+'"]');
    if(tab) tab.click();
    if(page === "special"){
      const ordersTitle = document.querySelector("#tab-orders h3");
      if(ordersTitle) ordersTitle.textContent = "Transaksi khusus";
    }
    if(page === "notifications"){
      setTimeout(() => $("notificationQueueTable")?.scrollIntoView({behavior:"smooth",block:"center"}), 120);
    }
    if(page === "store-settings" && currentRole !== "super_admin"){
      showOnly("placeholderView");
    }
    return;
  }

  const info = pageInfo[page];
  if(info){
    $("categoryOrderPanel")?.classList.add("hidden");
    $("productCategoriesPanel")?.classList.add("hidden");
    showOnly("placeholderView");
    $("placeholderTitle").textContent = info[0];
    $("placeholderSubtitle").textContent = info[1];
    $("placeholderHeading").textContent = "Modul sedang disiapkan";
    $("placeholderText").textContent = info[2];
    return;
  }
  showOnly("overviewView");
}

function bindNavigation(){
  document.querySelectorAll(".group-toggle").forEach(button => {
    button.addEventListener("click", () => button.closest(".nav-group").classList.toggle("closed"));
  });
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => activatePage(button.dataset.page));
  });
  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
    $("scrim").classList.toggle("show");
  });
  $("scrim").addEventListener("click", closeMobileMenu);
}

async function loadAdminAccounts() {
  if (currentRole !== "super_admin") return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,role,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  $("membersTable").innerHTML = data.length
    ? '<table><thead><tr><th>Nama</th><th>Email</th><th>Akses CMS</th><th>Dibuat</th></tr></thead><tbody>' +
      data.map(profile => {
        const name = esc(profile.display_name || "—");
        const email = esc(profile.email || "—");
        const date = esc(new Date(profile.created_at).toLocaleDateString("id-ID"));
        if (profile.role === "super_admin") {
          return '<tr><td>' + name + '</td><td>' + email +
            '</td><td><strong>Super Admin (terlindungi)</strong></td><td>' + date + '</td></tr>';
        }
        const selected = profile.role && roleLabels[profile.role] ? profile.role : "none";
        const options = [
          ["none", "Belum diberi akses"],
          ["customer", "Pelanggan (tanpa akses CMS)"],
          ["admin", "Admin (akses penuh)"],
           
        ];
        return '<tr><td>' + name + '</td><td>' + email +
          '</td><td><select data-role-user="' + esc(profile.id) + '">' +
          options.map(([value, label]) => '<option value="' + value + '" ' + (selected === value ? "selected" : "") + '>' + label + '</option>').join("") +
          '</select></td><td>' + date + '</td></tr>';
      }).join("") +
      '</tbody></table>'
    : '<p class="muted">Belum ada akun di Supabase Auth.</p>';

  $("membersTable").querySelectorAll("[data-role-user]").forEach(select => {
    select.addEventListener("change", async () => {
      select.disabled = true;
      const { error: updateError } = await supabase.rpc("admin_set_user_role", {
        p_user_id: select.dataset.roleUser,
        p_role: select.value
      });
      select.disabled = false;

      if (updateError) {
        status("Hak akses gagal diperbarui: " + updateError.message);
        await loadAdminAccounts();
        return;
      }

      status("Role " + (roleLabels[select.value] || "Belum diberi akses") + " berhasil diterapkan.");
      await loadAdminAccounts();
    });
  });
}

async function init() {
  bindNavigation();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  if (!session) {
    location.href = "/";
    return;
  }

  currentUser = session.user;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile || !["admin", "super_admin"].includes(profile.role)) {
    await supabase.auth.signOut();
    alert("Akun ini belum memiliki akses CMS Bos Pangan.");
    location.href = "/";
    return;
  }

  currentRole = profile.role;
  // Current release uses only Super Admin, Admin, and Customer roles.
  // Article access is enforced by Supabase RLS on cms_articles.
  currentPermissions = [];
  const displayName = profile.display_name || currentUser.email || "Admin";
  const roleName = roleLabels[currentRole] || "Admin";
  $("welcome").textContent = "Selamat datang, " + displayName + ". Pilih menu di samping untuk mulai mengelola website.";
  $("identity")?.textContent && ($("identity").textContent = profile.email || currentUser.email || "");
  $("roleBadge").textContent = "Hak akses: " + roleName;
  $("topName").textContent = displayName;
  $("topRole").textContent = roleName;
  $("avatar").textContent = (displayName.trim().slice(0,2) || "BP").toUpperCase();
  $("adminView").classList.remove("hidden");

  if (currentRole !== "super_admin") {
    document.querySelectorAll("[data-super-only]").forEach(node => node.classList.add("hidden"));
  } else {
    await loadAdminAccounts();
  }

  // Until each CMS module has its own permission-aware interface, custom roles
  // receive a safe overview-only workspace rather than seeing unusable controls.
  if (!["admin", "super_admin"].includes(currentRole)) {
    document.querySelectorAll("[data-page]").forEach(node => {
      if (node.dataset.page !== "overview") node.classList.add("hidden");
    });
    document.querySelectorAll(".quick-card").forEach(node => node.classList.add("hidden"));
    status("Akses aktif: " + roleName + ". Antarmuka modul sesuai hak akses akan diaktifkan bertahap.");
  } else {
    status("Dashboard CMS siap.");
  }
  activatePage("overview");
}

$("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/cms/";
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) location.href = "/cms/";
});

init().catch(error => {
  console.error("Bos Pangan CMS:", error);
  status("Dashboard gagal dimuat: " + (error?.message || "Kesalahan tidak diketahui"));
});
