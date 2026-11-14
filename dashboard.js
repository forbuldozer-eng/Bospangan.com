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
        const selected = profile.role === "admin" ? "admin" : "none";
        return '<tr><td>' + name + '</td><td>' + email +
          '</td><td><select data-role-user="' + esc(profile.id) + '">' +
          '<option value="none" ' + (selected === "none" ? "selected" : "") + '>Tidak ada akses CMS</option>' +
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
        : "Akses CMS berhasil dicabut.");
      await loadAdminAccounts();
    });
  });
}

async function init() {
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
  $("welcome").textContent = "Halo, " + (profile.display_name || currentUser.email || "Admin");
  $("identity").textContent = profile.email || currentUser.email || "";
  $("roleBadge").textContent = "Hak akses: " + (currentRole === "super_admin" ? "Super Admin" : "Admin");
  $("adminView").classList.remove("hidden");

  if (currentRole === "super_admin") {
    $("accessPanel").classList.remove("hidden");
    await loadAdminAccounts();
  }

  status("Dashboard CMS siap.");
}

$("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) location.href = "/";
});

init().catch(error => {
  console.error("Bos Pangan CMS:", error);
  status("Dashboard gagal dimuat: " + (error?.message || "Kesalahan tidak diketahui"));
});
