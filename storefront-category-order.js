import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const grid = document.getElementById("homepageCategoryLinks");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(label + " melewati batas waktu 12 detik.")), 12000);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function render(categories, orderRows = []) {
  if (!grid) return;
  const bySlug = new Map(orderRows.map((row) => [row.slug, row]));
  const visible = [...categories]
    .filter((category) => bySlug.get(category.slug)?.is_visible !== false)
    .sort((a, b) =>
      Number(bySlug.get(a.slug)?.sort_order ?? a.sort_order ?? 0)
        - Number(bySlug.get(b.slug)?.sort_order ?? b.sort_order ?? 0)
      || a.name.localeCompare(b.name, "id")
    );

  if (!visible.length) {
    grid.innerHTML = '<p class="muted">Belum ada kategori dari produk yang dipublikasikan.</p>';
    return;
  }

  grid.innerHTML = visible.map((category) =>
    '<a class="category-card" href="/#katalog" data-category-name="' + escapeHtml(category.name) + '">'
      + (category.icon ? '<span aria-hidden="true">' + escapeHtml(category.icon) + '</span> ' : '')
      + escapeHtml(category.name) + '</a>'
  ).join("");

  grid.querySelectorAll("[data-category-name]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("bp:select-category", {
        detail: { name: link.dataset.categoryName },
      }));
    });
  });
}

async function load() {
  if (!grid) return;
  grid.setAttribute("aria-busy", "true");
  try {
    const { data: categories, error: categoryError } = await withTimeout(
      db.from("product_categories")
        .select("id,name,slug,icon,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      "Memuat master kategori"
    );

    let activeCategories = categories || [];
    if (categoryError || activeCategories.length === 0) {
      // Derive fallback categories only from products actually published in the catalogue.
      const { data: products, error: productsError } = await withTimeout(
        db.from("products")
          .select("category")
          .eq("is_published", true)
          .order("category", { ascending: true }),
        "Memuat kategori dari produk"
      );

      if (productsError) throw productsError;
      const names = [...new Set((products || []).map((product) => String(product.category || "").trim()).filter(Boolean))];
      activeCategories = names.map((name, index) => ({
        id: "published-product-category-" + index,
        name,
        slug: name.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        icon: "",
        sort_order: index,
      }));
    }

    let orders = [];
    const { data: orderRows, error: orderError } = await withTimeout(
      db.from("homepage_category_order")
        .select("slug,sort_order,is_visible")
        .order("sort_order", { ascending: true }),
      "Memuat urutan kategori"
    );
    if (!orderError) orders = orderRows || [];

    render(activeCategories, orders);
    if (categoryError) console.warn("Bos Pangan: kategori memakai hasil produk terpublikasi karena master kategori gagal dimuat.", categoryError);
  } catch (error) {
    console.error("Bos Pangan homepage categories:", error);
    grid.innerHTML = '<p class="muted">Kategori belum dapat dimuat. Silakan muat ulang halaman.</p>';
  } finally {
    grid.removeAttribute("aria-busy");
  }
}

load();
