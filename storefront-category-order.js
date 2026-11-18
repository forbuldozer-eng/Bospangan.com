import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const grid = document.getElementById("homepageCategoryLinks");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function render(categories, orderRows) {
  if (!grid) return;
  const bySlug = new Map((orderRows || []).map((row) => [row.slug, row]));
  const visible = [...(categories || [])].filter((c) => bySlug.get(c.slug)?.is_visible !== false)
    .sort((a,b) => Number(bySlug.get(a.slug)?.sort_order ?? a.sort_order ?? 0) - Number(bySlug.get(b.slug)?.sort_order ?? b.sort_order ?? 0) || a.name.localeCompare(b.name,"id"));
  if (!visible.length) { grid.innerHTML = '<p class="muted">Kategori produk belum tersedia.</p>'; return; }
  grid.innerHTML = visible.map((c) => '<a class="category-card" href="/#katalog" data-category-name="' + escapeHtml(c.name) + '">' + (c.icon ? '<span aria-hidden="true">' + escapeHtml(c.icon) + '</span> ' : '') + escapeHtml(c.name) + '</a>').join("");
  grid.querySelectorAll("[data-category-name]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("bp:select-category", {detail:{name:link.dataset.categoryName}}));
  }));
}
async function load() {
  if (!grid) return;
  grid.setAttribute("aria-busy", "true");
  try {
    const categoryRequest = db.from("product_categories")
      .select("id,name,slug,icon,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    const timeout = new Promise((_, reject) =>
      window.setTimeout(() => reject(new Error("Koneksi kategori melewati batas waktu.")), 12000)
    );
    const { data: categories, error: categoryError } = await Promise.race([categoryRequest, timeout]);
    if (categoryError) throw categoryError;

    let orders = [];
    try {
      const result = await db.from("homepage_category_order")
        .select("slug,sort_order,is_visible")
        .order("sort_order", { ascending: true });
      if (result.error) console.warn("Pengaturan urutan kategori tidak tersedia; memakai urutan master kategori.", result.error);
      else orders = result.data || [];
    } catch (orderError) {
      console.warn("Pengaturan urutan kategori tidak tersedia; memakai urutan master kategori.", orderError);
    }
    render(categories, orders);
  } catch (error) {
    console.error("Bos Pangan homepage categories:", error);
    grid.innerHTML = '<p class="muted">Kategori belum dapat dimuat. Periksa koneksi katalog dan coba muat ulang.</p>';
  } finally {
    grid.removeAttribute("aria-busy");
  }
}
load();
