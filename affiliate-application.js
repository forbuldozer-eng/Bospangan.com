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
  if (application.status === "approved" && affiliate?.status === "active") {
    title = "Pengajuan disetujui";
    copy = "Selamat, akun affiliate Anda aktif. Kode referral Anda: " + affiliate.affiliate_code + ".";
  } else if (application.status === "rejected") {
    title = "Pengajuan belum disetujui";
    copy = application.review_note || "Pengajuan Anda belum disetujui. Silakan hubungi admin Bos Pangan untuk informasi lebih lanjut.";
  }
  const referralUrl = affiliate?.affiliate_code
    ? new URL("/?ref=" + encodeURIComponent(affiliate.affiliate_code), location.origin).toString()
    : "";
  $("existingState").innerHTML = "<strong>" + esc(title) + "</strong><span>" + esc(copy) + "</span>" +
    '<p class="muted">Diajukan: ' + esc(new Date(application.created_at).toLocaleString("id-ID")) + "</p>" +
    (application.status === "approved" && affiliate?.status === "active"
      ? '<section class="referral-panel" aria-label="Perangkat promosi affiliate">' +
        '<h3 style="margin:16px 0 6px">Link affiliate Anda</h3>' +
        '<p class="muted">Bagikan link ini kepada customer. Jika mereka membuka link dan berbelanja sesuai ketentuan, referral akan dikaitkan dengan akun Anda.</p>' +
        '<label for="affiliateReferralLink">Link promosi</label>' +
        '<input id="affiliateReferralLink" type="text" readonly value="' + esc(referralUrl) + '" style="width:100%;padding:12px;border:1px solid #ccd8ce;border-radius:10px;background:#fff;color:#183d31;margin:6px 0 10px">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" id="copyAffiliateLink">Salin link affiliate</button>' +
        '<button type="button" class="secondary" id="shareAffiliateLink">Bagikan via WhatsApp</button>' +
        '</div>' +
        '<p id="affiliateLinkStatus" class="muted" role="status" aria-live="polite"></p>' +
        '<p class="muted">Kode referral: <strong>' + esc(affiliate.affiliate_code) + '</strong></p>' +
        '<p class="muted">Masa atribusi referral: 90 hari. Komisi mengikuti ketentuan program.</p>' +
        '</section>'
      : ""); 
  if (application.status === "approved" && affiliate?.status === "active") {
    loadAffiliateFinance(affiliate).catch(error => {
      const node = $("affiliateFinanceStatus");
      if (node) node.textContent = error.message || "Data komisi belum dapat dimuat.";
    });
    $("copyAffiliateLink").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(referralUrl);
        $("affiliateLinkStatus").textContent = "Link affiliate berhasil disalin.";
      } catch {
        const input = $("affiliateReferralLink");
        input.focus(); input.select();
        $("affiliateLinkStatus").textContent = "Pilih dan salin link di atas.";
      }
    });
    $("shareAffiliateLink").addEventListener("click", () => {
      const text = "Yuk, lihat produk pangan di Bos Pangan melalui link saya: " + referralUrl;
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
    });
  }
}
async function loadAffiliateFinance(affiliate) {
  const [commissionResult, withdrawalResult] = await Promise.all([
    db.from("affiliate_commissions").select("amount,status,created_at,note").eq("affiliate_id", affiliate.id).order("created_at", { ascending: false }),
    db.from("affiliate_withdrawals").select("id,amount,payment_method,payment_account_name,payment_account_number,status,review_note,created_at").eq("affiliate_id", affiliate.id).order("created_at", { ascending: false })
  ]);
  if (commissionResult.error) throw new Error("Riwayat komisi: " + commissionResult.error.message);
  if (withdrawalResult.error) throw new Error("Riwayat pencairan: " + withdrawalResult.error.message);
  const commissions = commissionResult.data || [];
  const withdrawals = withdrawalResult.data || [];
  const earned = commissions.filter(x => x.status !== "void").reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const availableCommission = commissions.filter(x => x.status === "available").reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const reserved = withdrawals.filter(x => ["pending","approved","paid"].includes(x.status)).reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const available = Math.max(0, availableCommission - reserved);
  const money = value => "Rp" + Number(value || 0).toLocaleString("id-ID");
  const statusLabel = {pending:"Menunggu review",approved:"Disetujui",rejected:"Ditolak",paid:"Sudah dibayar"};
  const finance = document.createElement("section");
  finance.className = "state";
  finance.id = "affiliateFinance";
  finance.innerHTML = `
    <h3 style="margin:0 0 12px">Komisi dan pencairan</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
      <div class="state"><small class="muted">Total komisi tercatat</small><strong>${money(earned)}</strong></div>
      <div class="state"><small class="muted">Saldo dapat dicairkan</small><strong>${money(available)}</strong></div>
    </div>
    <h3 style="margin:18px 0 8px">Ajukan pencairan komisi</h3>
    <p class="muted">Masukkan tujuan pembayaran dan nominal yang ingin dicairkan. Permintaan akan ditinjau oleh admin Bos Pangan.</p>
    <form id="affiliateClaimForm">
      <label>Metode pembayaran
        <select name="payment_method" required>
          <option value="">Pilih metode</option><option value="Bank Transfer">Transfer bank</option><option value="E-Wallet">E-wallet</option>
        </select>
      </label>
      <label>Nama pemilik rekening / akun<input name="payment_account_name" required maxlength="120" autocomplete="name" placeholder="Sesuai nama pemilik rekening"></label>
      <label>Nama bank / penyedia e-wallet<input name="payment_provider" required maxlength="60" placeholder="Contoh: BCA, BRI, Mandiri, DANA"></label>
      <label>Nomor rekening / nomor akun<input name="payment_account_number" required maxlength="80" inputmode="numeric" placeholder="Masukkan nomor rekening atau akun"></label>
      <label>Nominal pencairan (Rp)<input name="amount" type="number" min="1" max="${Math.floor(available)}" step="1" required placeholder="Maksimal ${money(available)}" ${available < 1 ? "disabled" : ""}></label>
      <button type="submit" ${available < 1 ? "disabled" : ""}>Ajukan pencairan</button>
      <p id="affiliateFinanceStatus" class="status" role="status" aria-live="polite"></p>
    </form>
    <h3 style="margin:18px 0 8px">Riwayat pencairan</h3>
    ${withdrawals.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Tanggal</th><th align="left">Nominal</th><th align="left">Tujuan</th><th align="left">Status</th></tr></thead><tbody>${withdrawals.map(w => `<tr><td>${esc(new Date(w.created_at).toLocaleDateString("id-ID"))}</td><td>${money(w.amount)}</td><td>${esc(w.payment_method)} · ${esc(w.payment_account_name)}<br><small>${esc(w.payment_account_number)}</small></td><td>${esc(statusLabel[w.status] || w.status)}${w.review_note ? "<br><small>" + esc(w.review_note) + "</small>" : ""}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Belum ada permintaan pencairan.</p>'}
    <h3 style="margin:18px 0 8px">Riwayat komisi</h3>
    ${commissions.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Tanggal</th><th align="left">Catatan</th><th align="left">Nominal</th><th align="left">Status</th></tr></thead><tbody>${commissions.map(c => `<tr><td>${esc(new Date(c.created_at).toLocaleDateString("id-ID"))}</td><td>${esc(c.note || "Komisi affiliate")}</td><td>${money(c.amount)}</td><td>${esc(c.status)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Belum ada komisi yang dicatat admin.</p>'}
  `;
  $("existingState").append(finance);
  $("affiliateClaimForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get("amount"));
    const provider = String(data.get("payment_provider") || "").trim();
    const method = String(data.get("payment_method") || "").trim();
    const submit = form.querySelector('button[type="submit"]');
    if (!Number.isFinite(amount) || amount <= 0 || amount > available) {
      $("affiliateFinanceStatus").textContent = "Nominal melebihi saldo yang dapat dicairkan.";
      return;
    }
    submit.disabled = true;
    submit.textContent = "Mengirim pengajuan…";
    try {
      const { error } = await db.rpc("request_affiliate_withdrawal", {
        p_amount: amount,
        p_payment_method: method + " - " + provider,
        p_payment_account_name: String(data.get("payment_account_name") || "").trim(),
        p_payment_account_number: String(data.get("payment_account_number") || "").trim()
      });
      if (error) throw error;
      $("affiliateFinanceStatus").textContent = "Pengajuan pencairan berhasil dikirim dan menunggu pemeriksaan admin.";
      await loadAffiliateFinance(affiliate);
    } catch (error) {
      $("affiliateFinanceStatus").textContent = error.message || "Pengajuan pencairan gagal.";
    } finally {
      submit.disabled = false;
      submit.textContent = "Ajukan pencairan";
    }
  });
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
      .select("id,affiliate_code,status").eq("user_id", currentUser.id).maybeSingle();
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
