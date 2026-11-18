import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
let currentUser = null;
let profile = null;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function showView(id) {
  ["viewLoading","authView","applicationView","existingView"].forEach(key => $(key).classList.toggle("hidden", key !== id));
}
function message(id, text, tone = "") {
  const node = $(id);
  node.textContent = text;
  node.className = "status" + (tone ? " " + tone : "");
}
function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) { button.dataset.original = button.textContent; button.textContent = label; }
  else button.textContent = button.dataset.original || button.textContent;
  button.disabled = busy;
}
function authMode(mode) {
  const signup = mode === "signup";
  $("authHeading").textContent = signup ? "Buat akun pelanggan" : "Masuk untuk mendaftar";
  $("authIntro").textContent = signup
    ? "Buat akun pelanggan Bos Pangan terlebih dahulu."
    : "Masuk atau buat akun pelanggan sebelum mengajukan diri sebagai affiliate.";
  $("signupForm").classList.toggle("hidden", !signup);
  $("loginForm").classList.toggle("hidden", signup);
  $("authSwitch").innerHTML = signup
    ? 'Sudah punya akun? <button type="button" id="showLogin">Masuk</button>'
    : 'Belum punya akun? <button type="button" id="showSignup">Daftar pelanggan</button>';
  $(signup ? "showLogin" : "showSignup").addEventListener("click", () => authMode(signup ? "login" : "signup"));
  message("authStatus", "");
}
async function ensureProfile() {
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user) throw new Error("Sesi login tidak ditemukan. Silakan masuk kembali.");
  currentUser = user;
  const { data: result, error } = await db.rpc("ensure_customer_profile", {
    p_display_name: user.user_metadata?.display_name || user.user_metadata?.name || ""
  });
  if (error) throw new Error("Akun pelanggan belum siap: " + error.message);
  const { data: row, error: profileError } = await db.from("profiles")
    .select("id,display_name,email,role").eq("id", user.id).single();
  if (profileError || !row) throw new Error("Profil pelanggan tidak dapat dibaca: " + (profileError?.message || ""));
  profile = row;
  if (["admin","super_admin"].includes(row.role) || ["admin","super_admin"].includes(result)) {
    throw new Error("Akun administrator tidak dapat mengajukan diri sebagai affiliate. Gunakan akun pelanggan.");
  }
  if (row.role !== "customer") throw new Error("Akun belum memiliki role pelanggan. Silakan hubungi admin Bos Pangan.");
}
function renderState(application, affiliate) {
  showView("existingView");
  let title = "Pengajuan sedang ditinjau";
  let copy = "Pengajuan Anda sudah diterima dan menunggu pemeriksaan tim Bos Pangan.";
  if (application.status === "approved" && affiliate) {
    title = "Pengajuan disetujui";
    copy = "Selamat, akun affiliate Anda aktif. Kode referral Anda: " + affiliate.affiliate_code + ".";
  } else if (application.status === "rejected") {
    title = "Pengajuan belum disetujui";
    copy = application.review_note || "Pengajuan Anda belum disetujui. Silakan hubungi admin Bos Pangan untuk informasi lebih lanjut.";
  }
  $("existingState").innerHTML = "<strong>" + esc(title) + "</strong><span>" + esc(copy) + "</span>" +
    '<p class="muted">Diajukan: ' + esc(new Date(application.created_at).toLocaleString("id-ID")) + "</p>" +
    (application.status === "approved" && affiliate
      ? '<p class="muted">Masa atribusi referral: 90 hari. Komisi mengikuti ketentuan program.</p>'
      : "");
}
async function loadApplication() {
  showView("viewLoading");
  await ensureProfile();
  $("applicationForm").elements.applicant_name.value = profile.display_name || currentUser.user_metadata?.display_name || "";
  $("applicationForm").elements.applicant_email.value = profile.email || currentUser.email || "";
  const { data: application, error } = await db.from("affiliate_applications")
    .select("id,applicant_name,applicant_email,whatsapp,promotion_channel,reason,status,review_note,created_at")
    .eq("user_id", currentUser.id).maybeSingle();
  if (error) throw new Error("Status pengajuan belum dapat dibaca: " + error.message);
  if (!application) { showView("applicationView"); return; }
  let affiliate = null;
  if (application.status === "approved") {
    const { data, error: affiliateError } = await db.from("affiliates")
      .select("affiliate_code,status").eq("user_id", currentUser.id).maybeSingle();
    if (affiliateError) throw new Error("Status affiliate belum dapat dibaca: " + affiliateError.message);
    affiliate = data;
  }
  renderState(application, affiliate);
}
async function refresh() {
  try {
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw error;
    if (!session) {
      currentUser = null;
      showView("authView");
      authMode("login");
      return;
    }
    await loadApplication();
  } catch (error) {
    showView("authView");
    authMode("login");
    message("authStatus", error.message || "Tidak dapat memuat halaman affiliate.", "error");
  }
}
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  setBusy(form, true, "Memeriksa akun…");
  try {
    const { error } = await db.auth.signInWithPassword({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value
    });
    if (error) throw error;
    await refresh();
  } catch (error) {
    message("authStatus", error.message || "Login gagal.", "error");
  } finally { setBusy(form, false); }
});
$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  setBusy(form, true, "Membuat akun…");
  try {
    const name = form.elements.name.value.trim();
    const { data, error } = await db.auth.signUp({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
      options: { data: { display_name: name, signup_source: "bospangan_affiliate" }, emailRedirectTo: location.origin + "/affiliate/" }
    });
    if (error) throw error;
    if (!data.session) {
      message("authStatus", "Akun berhasil didaftarkan. Periksa email untuk verifikasi, lalu masuk kembali di halaman ini.", "success");
    } else {
      await refresh();
    }
  } catch (error) {
    message("authStatus", error.message || "Pendaftaran gagal.", "error");
  } finally { setBusy(form, false); }
});
$("applicationForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  values.applicant_name = String(values.applicant_name || "").trim();
  values.applicant_email = String(values.applicant_email || "").trim();
  values.whatsapp = String(values.whatsapp || "").trim();
  values.promotion_channel = String(values.promotion_channel || "").trim();
  values.reason = String(values.reason || "").trim();
  if (values.whatsapp.length < 8) return message("appStatus", "Nomor WhatsApp belum lengkap.", "error");
  if (values.reason.length < 20) return message("appStatus", "Rencana promosi minimal 20 karakter.", "error");
  const button = $("submitApplication");
  button.disabled = true;
  button.textContent = "Mengirim pengajuan…";
  try {
    const { error } = await db.from("affiliate_applications").insert({
      user_id: currentUser.id,
      applicant_name: values.applicant_name,
      applicant_email: values.applicant_email,
      whatsapp: values.whatsapp,
      promotion_channel: values.promotion_channel,
      reason: values.reason,
      status: "pending"
    });
    if (error) throw error;
    message("appStatus", "Pengajuan berhasil dikirim. Anda dapat memeriksa statusnya kembali di halaman ini.", "success");
    await loadApplication();
  } catch (error) {
    message("appStatus", error.message || "Pengajuan gagal dikirim.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Kirim pengajuan";
  }
});
async function logout() {
  await db.auth.signOut();
  currentUser = null;
  profile = null;
  await refresh();
}
$("logoutButton").addEventListener("click", logout);
$("logoutExisting").addEventListener("click", logout);
$("refreshStatus").addEventListener("click", refresh);
db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") refresh();
});
refresh();
