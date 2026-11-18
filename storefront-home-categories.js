import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const grid = document.getElementById("homepageCategoryLinks");

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

function showMessage(message, isError = false) {
  if (!grid) return;
  grid.innerHTML = `<p class="muted" role="status" style="grid-column:1/-1;color:${isError ? "#b42318" : "inherit"}">${escapeHtml(message)}</p>`;
}

function renderCategories(categories) {
  if (!categories.length) {
    showMessage("Belum ada kategori aktif. Silakan aktifkan kategori melalui CMS.");
    return;
  }

  grid.innerHTML = categories.map(category => {
    const icon = category.icon ? `<span aria-hidden="true">${escapeHtml(category.icon)}</span> ` : "";
    const description = category.description
      ? `<small style="display:block;margin-top:5px;font-weight:400;color:#64756c">${escapeHtml(category.description)}</small>`
      : "";
    return `<a class="category-card" href="/kategori/${encodeURIComponent(category.slug)}/">${icon}${escapeHtml(category.name)}${description}</a>`;
  }).join("");
}

async function applySavedOrder() {
  const { data, error } = await db
    .from("homepage_category_order")
    .select("slug,sort_order,is_visible")
    .order("sort_order", { ascending: true });

  // Ordering is optional; categories must remain visible if this table is unavailable.
  if (error || !Array.isArray(data) || !data.length) return;

  const links = [...grid.querySelectorAll('a.category-card')];
  const bySlug = new Map(links.map(link => [
    decodeURIComponent(new URL(link.href).pathname.split("/").filter(Boolean)[1] || ""),
    link
  ]));
  const ordered = [];
  data.forEach(item => {
    const link = bySlug.get(item.slug);
    if (!link) return;
    if (item.is_visible) ordered.push(link);
    bySlug.delete(item.slug);
  });
  links.forEach(link => {
    const slug = decodeURIComponent(new URL(link.href).pathname.split("/").filter(Boolean)[1] || "");
    if (bySlug.has(slug)) ordered.push(link);
  });
  grid.replaceChildren(...ordered);
}

async function loadCategories() {
  if (!grid) return;
  showMessage("Memuat kategori produk…");

  const { data, error } = await db
    .from("product_categories")
    .select("name,slug,description,icon,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    showMessage("Kategori belum dapat dimuat. Silakan muat ulang halaman. Jika masalah berlanjut, periksa tabel product_categories dan izin baca publik di Supabase.", true);
    console.error("[Bos Pangan] Gagal memuat kategori produk:", error);
    return;
  }

  renderCategories(data || []);
  await applySavedOrder();
}

loadCategories();
window.addEventListener("cms:product-categories-updated", loadCategories);
