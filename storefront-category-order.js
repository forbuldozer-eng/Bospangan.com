import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const grid = document.querySelector("#kategori-produk .category-links");

async function applyHomepageCategoryOrder() {
  if (!grid) return;
  const { data, error } = await db
    .from("homepage_category_order")
    .select("slug,sort_order,is_visible")
    .order("sort_order", { ascending: true });
  if (error || !data?.length) return;

  const links = [...grid.querySelectorAll('a[href^="/kategori/"]')];
  const bySlug = new Map(links.map(link => {
    const match = link.getAttribute("href").match(/^\/kategori\/([^/]+)\//);
    return [match?.[1], link];
  }));
  data.forEach(item => {
    const link = bySlug.get(item.slug);
    if (!link) return;
    link.hidden = !item.is_visible;
    grid.appendChild(link);
    bySlug.delete(item.slug);
  });
  links.forEach(link => {
    if (bySlug.has([...bySlug.entries()].find(([, node]) => node === link)?.[0])) grid.appendChild(link);
  });
}

applyHomepageCategoryOrder();
