import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const $ = id => document.getElementById(id);
const ready = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

let client = null;
let user = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

function show(title, html) {
  $("heading").textContent = title;
  $("panel").innerHTML = html;
  if (!$("box").open) {
    if (location.pathname === "/cms" || location.pathname === "/cms/") $("box").setAttribute("open", "");
    else $("box").showModal();
  }
}

function message(text, ok = false) {
  const element = $("authStatus");
  if (!element) return;
  element.className = ok ? "auth-success" : "auth-error";
  element.textContent = text;
}

function configNotice() {
  show("Login Admin", '<div class="auth-note">Konfigurasi Supabase belum lengkap. Periksa file <code>auth-config.js</code>.</div>');
}

function loginForm(notice = "") {
  if (!ready || !client) return configNotice();

  show("Login CMS Bos Pangan", `
    <form id="authForm" class="auth-form">
      <label>Email Admin
        <input name="email" type="email" autocomplete="username" maxlength="254" required>
      </label>
      <label>Password
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <p id="authStatus" class="auth-error" role="status">${esc(notice)}</p>
      <button class="primary full" type="submit">Masuk ke CMS</button>
    </form>
    <button id="forgot" class="full" type="button">Lupa password?</button>
    <p class="auth-small">Akun CMS dibuat oleh pemilik sistem. Pendaftaran publik tidak tersedia.</p>
  `);

  $("authForm").onsubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    message("Memeriksa akun…");

    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { user: signedInUser } } = await client.auth.getUser();
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role")
        .eq("id", signedInUser.id)
        .single();

      if (profileError || !profile || !["admin", "super_admin"].includes(profile.role)) {
        await client.auth.signOut();
        user = null;
        message("Akun berhasil dikenali, tetapi belum memiliki akses CMS. Hubungi Super Admin.");
        return;
      }

      user = signedInUser;
      location.href = "/dashboard.html";
    } catch (error) {
      message(error?.message || "Login gagal. Periksa email dan password.");
    } finally {
      submit.disabled = false;
    }
  };

  $("forgot").onclick = async () => {
    const email = $("authForm").elements.email.value.trim();
    if (!email) return message("Masukkan email akun terlebih dahulu.");
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/cms/`
    });
    message(error
      ? error.message
      : "Jika akun terdaftar, tautan pemulihan password akan dikirim ke email.",
      !error);
  };
}

async function account() {
  if (!user) return loginForm();

  const { data: profile, error } = await client
    .from("profiles")
    .select("display_name,role")
    .eq("id", user.id)
    .single();

  if (error || !profile || !["admin", "super_admin"].includes(profile.role)) {
    await client.auth.signOut();
    user = null;
    return loginForm("Akun ini tidak memiliki akses CMS Bos Pangan.");
  }

  const roleName = profile.role === "super_admin" ? "Super Admin" : "Admin";
  const name = profile.display_name || user.email || "Admin";

  show("Akun CMS", `
    <div class="account-card">
      <strong>${esc(name)}</strong>
      <p>${esc(user.email)}</p>
      <p>Peran: ${esc(roleName)}</p>
    </div>
    <div class="auth-actions">
      <button id="goDashboard" type="button">Buka Dashboard CMS</button>
      <button id="rename" type="button">Ubah Nama</button>
      <button id="logout" type="button">Keluar</button>
    </div>
    <p id="authStatus" role="status"></p>
  `);

  $("goDashboard").onclick = () => { location.href = "/dashboard.html"; };
  $("rename").onclick = async () => {
    const next = prompt("Nama tampilan:", profile.display_name || "");
    if (next === null) return;
    const { error: updateError } = await client
      .from("profiles")
      .update({ display_name: next.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (updateError) return message(updateError.message);
    await client.auth.updateUser({ data: { display_name: next.trim() } });
    await account();
  };
  $("logout").onclick = async () => {
    await client.auth.signOut();
    user = null;
    loginForm();
  };
}

function resetPassword() {
  show("Buat Password Baru", `
    <form id="resetForm" class="auth-form">
      <label>Password baru
        <input name="password" type="password" minlength="8" autocomplete="new-password" required>
      </label>
      <p id="authStatus" role="status"></p>
      <button class="primary full" type="submit">Simpan Password</button>
    </form>
  `);

  $("resetForm").onsubmit = async event => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    const { error } = await client.auth.updateUser({ password });
    if (error) return message(error.message);
    message("Password berhasil diperbarui.", true);
    await client.auth.signOut();
    user = null;
    loginForm("Password diperbarui. Silakan login kembali.");
  };
}

function open() {
  if (user) account();
  else loginForm();
}

window.TWSAuth = { open };

const accountButton = $("accountTop");
if (accountButton) {
  accountButton.textContent = "Login Admin";
  accountButton.onclick = () => { location.href = "/cms/"; };
}

if (ready) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  client.auth.onAuthStateChange((event, session) => {
    user = session?.user || null;
    if (event === "PASSWORD_RECOVERY") resetPassword();
  });
}

const isCmsPage = location.pathname === "/cms" || location.pathname === "/cms/";
if (isCmsPage) {
  $("closeBox")?.addEventListener("click", () => { location.href = "/"; });
  $("box")?.addEventListener("cancel", event => {
    event.preventDefault();
    location.href = "/";
  });

  if (!ready || !client) {
    configNotice();
  } else {
    client.auth.getSession().then(({ data, error }) => {
      if (error) {
        loginForm("Sesi tidak dapat diperiksa. Silakan login kembali.");
        return;
      }
      user = data?.session?.user || null;
      if (user) account();
      else loginForm();
    }).catch(() => loginForm("Tidak dapat menghubungkan sesi. Silakan coba lagi."));
  }
}
