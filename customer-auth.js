import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const dialog = $("box");
const panel = $("panel");
const title = $("heading");
const accountButton = $("accountTop");
let currentUser = null;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

function setMessage(text, success = false) {
  const node = $("customerAuthStatus");
  if (!node) return;
  node.className = success ? "customer-auth-success" : "customer-auth-error";
  node.textContent = text;
}

function show(titleText, html) {
  title.textContent = titleText;
  panel.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

function wirePasswordToggle(inputId, buttonId) {
  const input = $(inputId);
  const button = $(buttonId);
  if (!input || !button) return;
  button.addEventListener("click", () => {
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Sembunyikan" : "Tampilkan";
    button.setAttribute("aria-pressed", String(visible));
  });
}

function migrationHint() {
  return "Fitur akun pelanggan belum diaktifkan pada database. Super Admin perlu menjalankan supabase/customer-accounts.sql di Supabase SQL Editor.";
}

const ORDER_STATUS_DETAILS = {
  new: {
    label: "Menunggu konfirmasi Admin",
    description: "Admin sedang memeriksa ketersediaan produk, harga akhir, dan ongkos kirim.",
    tone: "pending",
  },
  quoted: {
    label: "Menunggu penawaran Admin",
    description: "Permintaan khusus sedang ditinjau. Admin akan menghubungi Anda untuk detail penawaran.",
    tone: "pending",
  },
  confirmed: {
    label: "Pesanan dikonfirmasi",
    description: "Pesanan telah dikonfirmasi oleh Admin Bos Pangan. Ikuti informasi selanjutnya dari Admin.",
    tone: "confirmed",
  },
  processing: {
    label: "Sedang diproses",
    description: "Pesanan sedang disiapkan oleh Bos Pangan.",
    tone: "processing",
  },
  shipped: {
    label: "Dalam pengiriman",
    description: "Pesanan telah diserahkan untuk pengiriman. Hubungi Admin untuk informasi pengiriman lebih lanjut.",
    tone: "shipped",
  },
  completed: {
    label: "Pesanan selesai",
    description: "Pesanan telah ditandai selesai oleh Admin Bos Pangan.",
    tone: "completed",
  },
  cancelled: {
    label: "Pesanan dibatalkan",
    description: "Pesanan ini telah dibatalkan dan tidak akan diproses. Hubungi Admin apabila Anda memerlukan bantuan.",
    tone: "cancelled",
  },
};

const PAYMENT_STATUS_LABELS = {
  unpaid: "Belum dibayar",
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  refunded: "Dana dikembalikan",
};

function orderStatusDetails(status) {
  return ORDER_STATUS_DETAILS[status] || {
    label: "Status: " + String(status || "Belum diketahui"),
    description: "Silakan hubungi Admin Bos Pangan untuk memastikan perkembangan pesanan.",
    tone: "pending",
  };
}

function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || String(status || "Belum diketahui");
}

function loginForm(notice = "") {
  show(new URLSearchParams(location.search).get("affiliate")==="1" ? "Masuk Program Affiliate" : "Masuk sebagai pelanggan", `
    <p class="customer-auth-intro">Masuk untuk mengelola informasi akun dan melihat riwayat pesanan Bos Pangan.</p>
    <form id="customerLoginForm" class="customer-auth-form">
      <label>Email
        <input name="email" type="email" autocomplete="username" maxlength="254" placeholder="nama@email.com" required>
      </label>
      <label>Password
        <span class="customer-password-field">
          <input id="customerLoginPassword" name="password" type="password" autocomplete="current-password" required>
          <button id="toggleCustomerLoginPassword" class="customer-password-toggle" type="button" aria-pressed="false">Tampilkan</button>
        </span>
      </label>
      <p id="customerAuthStatus" class="customer-auth-error" role="status">${esc(notice)}</p>
      <button class="primary customer-auth-submit" type="submit">Masuk</button>
    </form>
    <button id="customerForgot" class="customer-auth-secondary" type="button">Lupa password?</button>
    <div class="customer-auth-switch">Belum punya akun? <button id="goCustomerSignup" type="button">${new URLSearchParams(location.search).get("affiliate")==="1" ? "Daftar sebagai affiliate" : "Daftar pelanggan"}</button></div>
    <p class="customer-auth-foot">Login pelanggan terpisah dari halaman administrator <a href="/cms/">CMS Admin</a>.</p>
  `);

  wirePasswordToggle("customerLoginPassword", "toggleCustomerLoginPassword");
  $("goCustomerSignup").addEventListener("click", () => signupForm());
  $("customerForgot").addEventListener("click", async () => {
    const email = $("customerLoginForm").elements.email.value.trim();
    if (!email) return setMessage("Masukkan email terlebih dahulu.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + "/",
    });
    setMessage(error ? error.message : "Jika email terdaftar, tautan pemulihan password akan dikirim.", !error);
  });

  $("customerLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setMessage("Memeriksa akun…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error("Sesi login tidak ditemukan.");
      currentUser = user;
      await openAccountAfterLogin();
    } catch (error) {
      const detail = error?.message || "Login gagal.";
      setMessage(detail.includes("ensure_customer_profile") || detail.includes("function")
        ? migrationHint()
        : detail);
    } finally {
      submit.disabled = false;
    }
  });
}

function signupForm(notice = "") {
  show(new URLSearchParams(location.search).get("affiliate")==="1" ? "Daftar Program Affiliate" : "Daftar akun pelanggan", `
    <p class="customer-auth-intro">Buat akun Bos Pangan, lalu ajukan keanggotaan Program Affiliate untuk memperoleh kode referral dan memantau komisi.</p>
    <form id="customerSignupForm" class="customer-auth-form">
      <label>Nama lengkap
        <input name="display_name" type="text" autocomplete="name" maxlength="120" required>
      </label>
      <label>Email aktif
        <input name="email" type="email" autocomplete="email" maxlength="254" placeholder="nama@email.com" required>
      </label>
      <label>Password (minimal 8 karakter)
        <span class="customer-password-field">
          <input id="customerSignupPassword" name="password" type="password" autocomplete="new-password" minlength="8" required>
          <button id="toggleCustomerSignupPassword" class="customer-password-toggle" type="button" aria-pressed="false">Tampilkan</button>
        </span>
      </label>
      <label>Ulangi password
        <span class="customer-password-field">
          <input id="customerSignupPasswordConfirm" name="password_confirm" type="password" autocomplete="new-password" minlength="8" required>
          <button id="toggleCustomerSignupPasswordConfirm" class="customer-password-toggle" type="button" aria-pressed="false">Tampilkan</button>
        </span>
      </label>
      <details class="customer-terms">
        <summary>Ketentuan pelanggan Bos Pangan</summary>
        <ol>
          <li>Gunakan nama dan email aktif yang benar. Informasi kontak dipakai untuk konfirmasi pesanan.</li>
          <li>Akun bersifat pribadi. Jaga password dan jangan membagikan akses kepada orang lain.</li>
          <li>Pelanggan hanya dapat melihat profil dan riwayat pesanan miliknya sendiri. Akun pelanggan tidak memiliki akses ke CMS atau data pelanggan lain.</li>
          <li>Pesanan belum menjadi konfirmasi final sampai Admin memeriksa ketersediaan stok, harga akhir, ongkos kirim, dan detail pesanan.</li>
          <li>Pada tahap ini website belum menerima pembayaran online. Admin akan menghubungi pelanggan untuk instruksi pembayaran.</li>
          <li>Permintaan transaksi khusus merupakan permintaan penawaran dan baru berlaku setelah dikonfirmasi Admin.</li>
          <li>Pesanan dengan informasi palsu, penyalahgunaan, atau aktivitas mencurigakan dapat ditolak dan akses akun dapat ditinjau oleh pengelola.</li>
        </ol>
      </details>
      <label class="customer-terms-check">
        <input name="accept_terms" type="checkbox" required>
        <span>Saya telah membaca dan menyetujui Ketentuan Pelanggan Bos Pangan.</span>
      </label>
      <p id="customerAuthStatus" class="customer-auth-error" role="status">${esc(notice)}</p>
      <button class="primary customer-auth-submit" type="submit">Buat akun pelanggan</button>
    </form>
    <div class="customer-auth-switch">Sudah punya akun? <button id="goCustomerLogin" type="button">Masuk</button></div>
  `);

  wirePasswordToggle("customerSignupPassword", "toggleCustomerSignupPassword");
  wirePasswordToggle("customerSignupPasswordConfirm", "toggleCustomerSignupPasswordConfirm");
  $("goCustomerLogin").addEventListener("click", () => loginForm());

  $("customerSignupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.display_name.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmation = form.elements.password_confirm.value;
    if (password !== confirmation) return setMessage("Konfirmasi password belum sama.");
    if (name.length < 2) return setMessage("Nama lengkap minimal 2 karakter.");
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setMessage("Membuat akun pelanggan…");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            signup_source: "bospangan_customer",
          },
          emailRedirectTo: location.origin + "/",
        },
      });
      if (error) throw error;
      if (data.session && data.user) {
        currentUser = data.user;
        await ensureCustomerProfile(name);
        await refreshAccountButton();
        await renderAccount();
      } else {
        show("Periksa email Anda", `
          <div class="customer-auth-success customer-confirmation">
            Pendaftaran diterima. Supabase meminta verifikasi email sebelum akun dapat digunakan. Buka email dari Bos Pangan/Supabase, klik tautan verifikasi, lalu kembali ke website untuk login.
          </div>
          <button id="backCustomerLogin" class="primary customer-auth-submit" type="button">Kembali ke login</button>
        `);
        $("backCustomerLogin").addEventListener("click", () => loginForm());
      }
    } catch (error) {
      const detail = error?.message || "Pendaftaran tidak berhasil.";
      show("Daftar akun pelanggan", `
        <p class="customer-auth-error" role="status">${esc(detail.includes("ensure_customer_profile") ? migrationHint() : detail)}</p>
        <button id="retrySignup" class="primary customer-auth-submit" type="button">Coba lagi</button>
        <div class="customer-auth-switch">Sudah punya akun? <button id="retryLogin" type="button">Masuk</button></div>
      `);
      $("retrySignup").addEventListener("click", () => signupForm());
      $("retryLogin").addEventListener("click", () => loginForm());
    } finally {
      submit.disabled = false;
    }
  });
}

async function ensureCustomerProfile(displayName = "") {
  const { data: role, error } = await supabase.rpc("ensure_customer_profile", {
    p_display_name: displayName,
  });
  if (error) throw new Error(migrationHint() + " Detail: " + error.message);
  return role;
}

async function openAccountAfterLogin() {
  const { data: role, error } = await supabase.rpc("ensure_customer_profile", {
    p_display_name: currentUser?.user_metadata?.display_name || "",
  });
  if (error) {
    show("Akun pelanggan belum siap", `
      <p class="customer-auth-error">${esc(migrationHint())}</p>
      <p class="customer-auth-muted">${esc(error.message)}</p>
      <button id="customerRetryLogin" class="primary customer-auth-submit" type="button">Kembali ke login</button>
    `);
    $("customerRetryLogin").addEventListener("click", () => loginForm());
    return;
  }
  if (role === "admin" || role === "super_admin") {
    show("Akun administrator", `
      <p class="customer-auth-intro">Akun ini memiliki peran administrator, bukan akun pelanggan.</p>
      <a class="customer-auth-submit customer-auth-link" href="/cms/">Buka Login CMS Admin</a>
    `);
    await refreshAccountButton();
    return;
  }
  await renderAccount();
}

async function renderAccount() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return loginForm("Sesi login berakhir. Silakan masuk kembali.");
  currentUser = user;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name,email,role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) return show("Akun pelanggan", `
    <p class="customer-auth-error">${esc(migrationHint())}</p>
  `);
  if (profile.role === "admin" || profile.role === "super_admin") {
    await refreshAccountButton();
    return show("Akun administrator", '<p class="customer-auth-intro">Akun ini menggunakan akses CMS Administrator.</p><a class="customer-auth-submit customer-auth-link" href="/cms/">Buka CMS Admin</a>');
  }
  if (profile.role !== "customer") return loginForm("Akun belum memiliki role pelanggan. Jalankan migrasi akun pelanggan terlebih dahulu.");

  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,transaction_type,total,status,payment_status,created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const [{data: application, error: applicationError}, {data: affiliate, error: affiliateError}] = await Promise.all([
    supabase.from("affiliate_applications").select("id,status,review_note,created_at").eq("user_id",user.id).maybeSingle(),
    supabase.from("affiliates").select("id,affiliate_code,status,approved_at").eq("user_id",user.id).maybeSingle()
  ]);
  let affiliatePanel = "";
  if (affiliate && !affiliateError) {
    const [{data: commissions}, {data: withdrawals}] = await Promise.all([
      supabase.from("affiliate_commissions").select("id,amount,note,status,created_at").eq("affiliate_id",affiliate.id).order("created_at",{ascending:false}).limit(20),
      supabase.from("affiliate_withdrawals").select("id,amount,status,payment_method,created_at,review_note").eq("affiliate_id",affiliate.id).order("created_at",{ascending:false}).limit(20)
    ]);
    const commissionTotal = (commissions||[]).filter(x=>x.status!=="void").reduce((sum,x)=>sum+Number(x.amount||0),0);
    affiliatePanel = `
      <section class="customer-affiliate-panel">
        <h3>Dashboard Affiliate</h3>
        <p>Status: <strong>${esc(affiliate.status)}</strong></p>
        <p>Kode referral Anda: <strong>${esc(affiliate.affiliate_code)}</strong></p>
        <p class="customer-auth-muted">Bagikan tautan website dengan parameter ?ref=${esc(affiliate.affiliate_code)}. Referral berlaku selama 90 hari sejak calon pelanggan membuka tautan affiliate. Kunjungan melalui tautan affiliate lain akan mengganti atribusi sebelumnya.</p>
        <p>Total komisi tercatat: <strong>Rp${commissionTotal.toLocaleString("id-ID")}</strong></p>
        <h4>Riwayat komisi</h4>
        ${commissions?.length ? '<div class="customer-order-list">'+commissions.map(x=>'<article class="customer-order"><strong>Rp'+Number(x.amount).toLocaleString("id-ID")+'</strong><small>'+esc(x.note||"Komisi")+' · '+esc(new Date(x.created_at).toLocaleDateString("id-ID"))+'</small><small>Status: '+esc(x.status)+'</small></article>').join("")+'</div>' : '<p class="customer-auth-muted">Belum ada komisi.</p>'}
        <h4>Ajukan pencairan komisi</h4>
        <form id="affiliateWithdrawalForm">
          <label>Nominal pencairan (Rp)<input name="amount" type="number" min="1" step="1" required></label>
          <label>Metode pembayaran<input name="payment_method" maxlength="60" required placeholder="Transfer bank / e-wallet"></label>
          <label>Nama pemilik rekening<input name="payment_account_name" maxlength="120" required></label>
          <label>Nomor rekening / akun<input name="payment_account_number" maxlength="80" required></label>
          <button type="submit" class="primary customer-auth-submit">Kirim permintaan pencairan</button>
        </form>
        <p class="customer-auth-muted">Permintaan akan ditinjau Admin. Saldo yang sedang menunggu persetujuan tidak dapat diminta kembali.</p>
        <h4>Riwayat pencairan</h4>
        ${withdrawals?.length ? '<div class="customer-order-list">'+withdrawals.map(x=>'<article class="customer-order"><strong>Rp'+Number(x.amount).toLocaleString("id-ID")+'</strong><small>'+esc(x.payment_method)+' · '+esc(new Date(x.created_at).toLocaleDateString("id-ID"))+'</small><small>Status: '+esc(x.status)+'</small></article>').join("")+'</div>' : '<p class="customer-auth-muted">Belum ada permintaan pencairan.</p>'}
      </section>`;
  } else if (!applicationError && application) {
    affiliatePanel = `<section class="customer-affiliate-panel"><h3>Program Affiliate</h3><p>Pengajuan Anda: <strong>${esc(application.status)}</strong></p><p class="customer-auth-muted">${esc(application.review_note||"Tim Bos Pangan akan meninjau pengajuan Anda.")}</p></section>`;
  } else if (applicationError?.code !== "PGRST116" && applicationError) {
    affiliatePanel = '<section class="customer-affiliate-panel"><h3>Program Affiliate</h3><p class="customer-auth-muted">Program affiliate belum diaktifkan pada database. Jalankan migrasi affiliate terlebih dahulu.</p></section>';
  } else {
    affiliatePanel = `<section class="customer-affiliate-panel"><h3>Program Affiliate Bos Pangan</h3><p>Ajukan keanggotaan untuk memperoleh kode referral dan melihat komisi dari transaksi yang tercatat.</p><div class="customer-auth-muted"><strong>Ringkasan aturan Program Affiliate:</strong><ul><li>Referral berlaku 90 hari sejak tautan affiliate dibuka.</li><li>Kunjungan melalui tautan affiliate lain mengganti atribusi sebelumnya.</li><li>Satu pesanan hanya dapat dikaitkan dengan satu affiliate.</li><li>Komisi dicatat manual oleh Admin setelah transaksi diverifikasi.</li><li>Pesanan batal, transaksi fiktif, dan penyalahgunaan referral tidak memperoleh komisi.</li></ul></div><form id="affiliateApplyForm">
      <label>Nomor WhatsApp<input name="whatsapp" type="tel" maxlength="32" required placeholder="08xxxxxxxxxx"></label>
      <label>Kanal promosi<input name="promotion_channel" maxlength="160" required placeholder="Contoh: WhatsApp, Instagram, komunitas"></label>
      <label>Alasan bergabung<textarea name="reason" maxlength="1000" required></textarea></label>
      <button type="submit" class="primary customer-auth-submit">Ajukan sebagai Affiliate</button>
    </form></section>`;
  }

  const orderRows = orderError
    ? '<p class="customer-auth-muted">Riwayat pesanan belum tersedia. Pastikan migrasi customer-accounts.sql sudah dijalankan.</p>'
    : orders?.length
      ? '<div class="customer-order-list">' + orders.map((order) => {
          const statusInfo = orderStatusDetails(order.status);
          const paymentLabel = paymentStatusLabel(order.payment_status);
          const canCancel = order.payment_status === "unpaid" && (
            (order.transaction_type === "regular" && order.status === "new") ||
            (order.transaction_type === "special" && order.status === "quoted")
          );
          return `
            <article class="customer-order">
              <div><strong>${esc(order.order_number)}</strong><small>${esc(new Date(order.created_at).toLocaleDateString("id-ID"))}</small></div>
              <div><span>${order.transaction_type === "special" ? "Permintaan khusus" : "Pesanan reguler"}</span><strong>Rp${Number(order.total || 0).toLocaleString("id-ID")}</strong></div>
              <div class="customer-order-state customer-order-state--${esc(statusInfo.tone)}">${esc(statusInfo.label)}</div>
              <small class="customer-order-payment">Pembayaran: ${esc(paymentLabel)}</small>
              <p class="customer-order-description">${esc(statusInfo.description)}</p>
              ${canCancel ? `<button type="button" class="customer-auth-secondary customer-order-cancel" data-cancel-order="${esc(order.id)}">Batalkan pesanan</button>` : ""}
            </article>
          `;
        }).join("") + '</div>'
      : '<p class="customer-auth-muted">Belum ada pesanan yang tercatat di akun ini.</p>';

  show("Akun pelanggan", `
    <div class="customer-profile-card">
      <strong>${esc(profile.display_name || "Pelanggan Bos Pangan")}</strong>
      <span>${esc(profile.email || user.email)}</span>
      <small>Role: Pelanggan</small>
    </div>
    <div class="customer-account-actions">
      <button id="editCustomerName" type="button">Ubah nama</button>
      <button id="logoutCustomer" type="button">Keluar</button>
    </div>
    <h3 class="customer-history-title">Riwayat pesanan</h3>
    ${orderRows}
    ${affiliatePanel}
    ${orders?.length && !orderError ? '<p class="customer-auth-muted">Pesanan yang masih menunggu konfirmasi dan belum dibayar dapat dibatalkan. Setelah pembatalan berhasil, stok produk dikembalikan ke katalog.</p>' : ''}
  `);

  const affiliateWithdrawalForm = $("affiliateWithdrawalForm");
  if (affiliateWithdrawalForm) affiliateWithdrawalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form=event.currentTarget, data=new FormData(form), button=form.querySelector('[type="submit"]');
    button.disabled=true;
    const {error}=await supabase.rpc("request_affiliate_withdrawal",{
      p_amount:Number(data.get("amount")),
      p_payment_method:String(data.get("payment_method")||"").trim(),
      p_payment_account_name:String(data.get("payment_account_name")||"").trim(),
      p_payment_account_number:String(data.get("payment_account_number")||"").trim()
    });
    if(error){
      button.disabled=false;
      const message=document.createElement("p");message.className="customer-auth-error";message.textContent=error.message;form.append(message);return;
    }
    await renderAccount();
  });

  const affiliateApplyForm = $("affiliateApplyForm");
  if (affiliateApplyForm) affiliateApplyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const {error} = await supabase.from("affiliate_applications").insert({
      user_id:user.id,
      applicant_name:profile.display_name || user.user_metadata?.display_name || "Pelanggan",
      applicant_email:profile.email || user.email || "",
      whatsapp:String(data.get("whatsapp")||"").trim(),
      promotion_channel:String(data.get("promotion_channel")||"").trim(),
      reason:String(data.get("reason")||"").trim(),
      status:"pending"
    });
    if(error){
      button.disabled=false;
      const message=document.createElement("p");
      message.className="customer-auth-error";
      message.textContent=error.message;
      form.append(message);
      return;
    }
    await renderAccount();
  });

  panel.querySelectorAll("[data-cancel-order]").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.cancelOrder;
      if (!orderId) return;
      const approved = confirm("Batalkan pesanan ini? Stok produk akan dikembalikan ke katalog. Pembatalan tidak dapat dibuka kembali.");
      if (!approved) return;

      button.disabled = true;
      button.textContent = "Membatalkan...";
      const { error } = await supabase.rpc("cancel_customer_order", { p_order_id: orderId });
      if (error) {
        button.disabled = false;
        button.textContent = "Batalkan pesanan";
        const feedback = document.createElement("small");
        feedback.className = "customer-auth-error";
        feedback.textContent = error.message || "Pesanan tidak dapat dibatalkan.";
        button.insertAdjacentElement("afterend", feedback);
        return;
      }
      await renderAccount();
    });
  });

  $("editCustomerName").addEventListener("click", async () => {
    const next = prompt("Nama pelanggan:", profile.display_name || "");
    if (next === null) return;
    const clean = next.trim();
    if (clean.length < 2 || clean.length > 120) return show("Akun pelanggan", '<p class="customer-auth-error">Nama harus 2–120 karakter.</p>');
    const { error } = await supabase.from("profiles")
      .update({ display_name: clean, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return show("Akun pelanggan", '<p class="customer-auth-error">' + esc(error.message) + '</p>');
    await supabase.auth.updateUser({ data: { display_name: clean } });
    await renderAccount();
  });
  $("logoutCustomer").addEventListener("click", async () => {
    await supabase.auth.signOut();
    currentUser = null;
    await refreshAccountButton();
    loginForm();
  });
}

async function refreshAccountButton() {
  if (!accountButton) return;
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  if (!currentUser) {
    accountButton.textContent = "Masuk / Daftar";
    accountButton.onclick = open;
    return;
  }
  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", currentUser.id).maybeSingle();
  if (profile?.role === "admin" || profile?.role === "super_admin") {
    accountButton.textContent = "CMS Admin";
    accountButton.onclick = () => { location.href = "/cms/"; };
  } else {
    accountButton.textContent = "Akun Pelanggan";
    accountButton.onclick = open;
  }
}

async function open() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  if (!currentUser) return loginForm();
  await openAccountAfterLogin();
}

function resetPasswordForm() {
  show("Buat password baru", `
    <form id="customerResetForm" class="customer-auth-form">
      <label>Password baru
        <span class="customer-password-field">
          <input id="customerNewPassword" name="password" type="password" minlength="8" autocomplete="new-password" required>
          <button id="toggleCustomerNewPassword" class="customer-password-toggle" type="button">Tampilkan</button>
        </span>
      </label>
      <p id="customerAuthStatus" class="customer-auth-error" role="status"></p>
      <button class="primary customer-auth-submit" type="submit">Simpan password</button>
    </form>
  `);
  wirePasswordToggle("customerNewPassword", "toggleCustomerNewPassword");
  $("customerResetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = event.currentTarget.elements.password.value;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMessage(error.message);
    setMessage("Password berhasil diperbarui. Silakan login kembali.", true);
    await supabase.auth.signOut();
    await refreshAccountButton();
    loginForm("Password berhasil diperbarui.");
  });
}

accountButton.textContent = "Masuk / Daftar";
accountButton.onclick = open;

$("closeBox").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  if (event === "PASSWORD_RECOVERY") resetPasswordForm();
  if (event === "SIGNED_OUT" || !session) {
    if (accountButton) {
      accountButton.textContent = "Masuk / Daftar";
      accountButton.onclick = open;
    }
  } else {
    refreshAccountButton();
  }
});

refreshAccountButton();
if (new URLSearchParams(location.search).get("affiliate") === "1") open();
window.BPCustomerAuth = { open };
