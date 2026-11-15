import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const status = message => { $("status").textContent = message; };

let currentUser = null;
let currentRole = null;

const pageInfo = {
  news:["Berita / Blog","Kelola artikel dan publikasi Bos Pangan","Modul publikasi artikel belum dihubungkan ke database CMS."],
  pages:["Halaman Website","Kelola halaman informasi seperti Tentang Kami dan Kontak","Modul halaman statis memerlukan struktur konten dan workflow publikasi tersendiri."],
  feeds:["Feeds Timeline","Kelola konten timeline dan feed","Modul feeds belum memiliki tabel penyimpanan pada backend saat ini."],
  banner:["Banner Website","Kelola banner promosi yang tampil di website","Modul banner akan dihubungkan ke halaman utama setelah skema banner ditambahkan."],
  "category-order":["Urutan Kategori","Atur urutan kategori produk pada website","Modul pengurutan kategori belum tersedia di backend saat ini."],
  categories:["Kategori Produk","Kelola kategori katalog Bos Pangan","Kategori produk yang aktif saat ini mengikuti daftar kategori pada katalog. Pengelolaan dinamis memerlukan tabel kategori."],
  media:["Media & Galeri","Kelola foto produk dan aset website","Foto produk saat ini dikelola melalui form Produk dan disimpan di Supabase Storage."],
  invoice:["Invoice","Dokumen transaksi dan tagihan pelanggan","Backend saat ini menyimpan pesanan dan rincian transaksi; pembuatan invoice PDF belum tersedia."],
  customers:["Pelanggan","Data pelanggan dan preferensi komunikasi","Daftar pelanggan berbasis akun dan izin notifikasi belum disatukan ke satu modul CRM."],
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
  ["overviewView","placeholderView","accessPanel","adminView"].forEach(key => $(key).classList.toggle("hidden", key !== id));
}
function activatePage(page){
  const activeLinks = document.querySelectorAll(".nav-link");
  activeLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page));
  const labels = {
    overview:"Dashboard",products:"Produk",orders:"Pesanan",special:"Transaksi Khusus",
    campaigns:"Promosi Produk","store-settings":"Pengaturan Toko",admins:"Admin & Hak Akses",
    notifications:"Log Notifikasi"
  };
  $("crumb").textContent = labels[page] || pageInfo[page]?.[0] || "Dashboard";
  closeMobileMenu();

  if(page === "overview"){
    showOnly("overviewView");
    return;
  }
  if(page === "admins"){
    if(currentRole !== "super_admin") return;
    showOnly("accessPanel");
    return;
  }

  const commerceTabs = {products:"products",orders:"orders",special:"orders",campaigns:"campaigns","store-settings":"settings",notifications:"campaigns"};
  if(commerceTabs[page]){
    showOnly("adminView");
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
        const selected = profile.role === "admin" ? "admin" : profile.role === "customer" ? "customer" : "none";
        return '<tr><td>' + name + '</td><td>' + email +
          '</td><td><select data-role-user="' + esc(profile.id) + '">' +
          '<option value="none" ' + (selected === "none" ? "selected" : "") + '>Belum ditetapkan</option>' +
          '<option value="customer" ' + (selected === "customer" ? "selected" : "") + '>Pelanggan (tanpa akses CMS)</option>' +
          '<option value="admin" ' + (selected === "admin" ? "selected" : "") + '>Admin</option>' +
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

      status(select.value === "admin"
        ? "Akses Admin berhasil diberikan."
        : select.value === "customer"
          ? "Akun dikembalikan ke role Pelanggan."
          : "Akses CMS berhasil dicabut.");
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
  const displayName = profile.display_name || currentUser.email || "Admin";
  const roleName = currentRole === "super_admin" ? "Super Admin" : "Admin";
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

  status("Dashboard CMS siap.");
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
