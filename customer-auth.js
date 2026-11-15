import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const dialog = $("customerAuthBox");
const panel = $("customerAuthPanel");
const title = $("customerAuthTitle");
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

function loginForm(notice = "") {
  show("Masuk sebagai pelanggan", `
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
    <div class="customer-auth-switch">Belum punya akun? <button id="goCustomerSignup" type="button">Daftar pelanggan</button></div>
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
  show("Daftar akun pelanggan", `
    <p class="customer-auth-intro">Buat akun untuk menyimpan identitas pelanggan dan memantau pesanan Anda.</p>
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
  const { data: role } = await supabase.rpc("ensure_customer_profile", {
    p_display_name: currentUser?.user_metadata?.display_name || "",
  }).catch(() => ({ data: null }));
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

  const orderRows = orderError
    ? '<p class="customer-auth-muted">Riwayat pesanan belum tersedia. Pastikan migrasi customer-accounts.sql sudah dijalankan.</p>'
    : orders?.length
      ? '<div class="customer-order-list">' + orders.map((order) => `
          <article class="customer-order">
            <div><strong>${esc(order.order_number)}</strong><small>${esc(new Date(order.created_at).toLocaleDateString("id-ID"))}</small></div>
            <div><span>${order.transaction_type === "special" ? "Permintaan khusus" : "Pesanan reguler"}</span><strong>Rp${Number(order.total || 0).toLocaleString("id-ID")}</strong></div>
            <small>Status: ${esc(order.status)} · Pembayaran: ${esc(order.payment_status)}</small>
          </article>
        `).join("") + '</div>'
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
    <p class="customer-auth-muted">Pesanan menunggu konfirmasi Admin. Pembayaran dilakukan setelah Admin menghubungi Anda.</p>
  `);
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

$("customerAuthClose").addEventListener("click", () => dialog.close());
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
window.BPCustomerAuth = { open };
