import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.getElementById("adminView");
const TABLE = "product_categories";
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const slugify = value => String(value).toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")
  .replace(/^-|-$/g,"").slice(0,120);

let rows = [];
let editingId = null;
let busy = false;

function status(message, error = false) {
  const node = $("productCategoryStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = error ? "#b42318" : "#176b45";
  node.style.background = error ? "#fff1f0" : "#edf8f1";
}
function resetForm() {
  editingId = null;
  $("productCategoryForm").reset();
  $("categoryFormTitle").textContent = "Tambah kategori";
  $("categorySlug").value = "";
  $("cancelCategoryEdit").classList.add("hidden");
}
function render() {
  const list = $("productCategoriesTable");
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<p class="muted">Belum ada kategori. Tambahkan kategori pertama melalui formulir di atas.</p>';
    return;
  }
  list.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Slug</th><th>Produk</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
    rows.map(row => '<tr><td><strong>' + (esc(row.icon) ? esc(row.icon) + ' ' : '') + esc(row.name) +
      '</strong>' + (row.description ? '<br><small class="muted">' + esc(row.description) + '</small>' : '') +
      '</td><td>' + esc(row.slug) + '</td><td><span data-count="' + row.id + '">—</span></td><td>' +
      (row.is_active ? '<span style="color:#16834f;font-weight:700">Aktif</span>' : '<span class="muted">Nonaktif</span>') +
      '</td><td><button type="button" data-edit="' + row.id + '">Edit</button> ' +
      '<button type="button" data-toggle="' + row.id + '">' + (row.is_active ? 'Nonaktifkan' : 'Aktifkan') + '</button> ' +
      '<button type="button" data-delete="' + row.id + '">Hapus</button></td></tr>').join("") +
    '</tbody></table></div>';
  list.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => edit(rows.find(row => row.id === button.dataset.edit))));
  list.querySelectorAll("[data-toggle]").forEach(button => button.addEventListener("click", () => toggle(rows.find(row => row.id === button.dataset.toggle))));
  list.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => remove(rows.find(row => row.id === button.dataset.delete))));
  loadProductCounts();
}
async function loadProductCounts() {
  for (const row of rows) {
    const { count, error } = await db.from("products").select("id", { count:"exact", head:true }).eq("category", row.name);
    const node = document.querySelector('[data-count="' + row.id + '"]');
    if (node) node.textContent = error ? "—" : String(count ?? 0);
  }
}
async function load() {
  status("Memuat kategori produk dari Supabase…");
  const { data, error } = await db.from(TABLE).select("*").order("sort_order",{ascending:true}).order("name",{ascending:true});
  if (error) {
    rows = [];
    render();
    status("Gagal memuat kategori: " + error.message + ". Pastikan supabase/product-categories.sql sudah dijalankan.", true);
    return;
  }
  rows = data || [];
  render();
  status(rows.length + " kategori berhasil dimuat.");
}
function edit(row) {
  if (!row) return;
  editingId = row.id;
  const form = $("productCategoryForm").elements;
  form.name.value = row.name;
  form.slug.value = row.slug;
  form.description.value = row.description || "";
  form.icon.value = row.icon || "";
  form.is_active.checked = Boolean(row.is_active);
  $("categoryFormTitle").textContent = "Edit kategori · " + row.name;
  $("cancelCategoryEdit").classList.remove("hidden");
  $("productCategoryForm").scrollIntoView({behavior:"smooth",block:"center"});
}
async function toggle(row) {
  if (!row || busy) return;
  const { error } = await db.from(TABLE).update({is_active:!row.is_active,updated_at:new Date().toISOString()}).eq("id",row.id);
  if (error) { status("Status kategori gagal diubah: " + error.message,true); return; }
  status("Status kategori berhasil diperbarui.");
  await load();
}
async function remove(row) {
  if (!row || busy) return;
  const { count, error: countError } = await db.from("products").select("id",{count:"exact",head:true}).eq("category",row.name);
  if (countError) { status("Tidak dapat memeriksa produk terkait: " + countError.message,true); return; }
  if (count > 0) {
    status('Kategori "' + row.name + '" masih digunakan oleh ' + count + ' produk. Ubah kategori produk tersebut terlebih dahulu; kategori tidak dihapus agar data produk aman.',true);
    return;
  }
  if (!confirm('Hapus kategori "' + row.name + '"? Tindakan ini tidak dapat dibatalkan.')) return;
  const { error } = await db.from(TABLE).delete().eq("id",row.id);
  if (error) { status("Kategori gagal dihapus: " + error.message,true); return; }
  if (editingId === row.id) resetForm();
  status("Kategori berhasil dihapus.");
  await load();
}
async function submit(event) {
  event.preventDefault();
  if (busy) return;
  const form = $("productCategoryForm").elements;
  const name = form.name.value.trim();
  const slug = slugify(form.slug.value.trim() || name);
  if (!name || !slug) { status("Nama dan slug kategori wajib diisi.",true); return; }
  const existing = rows.find(row => row.slug === slug && row.id !== editingId);
  if (existing) { status("Slug sudah digunakan kategori lain.",true); return; }
  busy = true;
  const button = $("saveProductCategory");
  button.disabled = true;
  status("Menyimpan kategori…");
  try {
    const old = rows.find(row => row.id === editingId);
    if (old && old.name !== name) {
      const { error: productError } = await db.from("products").update({category:name}).eq("category",old.name);
      if (productError) throw new Error("Nama kategori belum dapat disinkronkan ke produk: " + productError.message);
    }
    const payload = {
      name, slug, description:form.description.value.trim(),
      icon:form.icon.value.trim(), is_active:form.is_active.checked,
      sort_order:old?.sort_order ?? rows.length + 1,
      updated_at:new Date().toISOString()
    };
    const result = old
      ? await db.from(TABLE).update(payload).eq("id",old.id)
      : await db.from(TABLE).insert(payload);
    if (result.error) {
      if (old && old.name !== name) await db.from("products").update({category:old.name}).eq("category",name);
      throw result.error;
    }
    resetForm();
    status("Kategori berhasil disimpan.");
    await load();
    window.dispatchEvent(new CustomEvent("cms:product-categories-updated"));
  } catch (error) {
    status("Gagal menyimpan kategori: " + (error.message || error),true);
  } finally {
    busy = false;
    button.disabled = false;
  }
}
function mount() {
  if (!root || $("productCategoriesPanel")) return;
  const panel = document.createElement("section");
  panel.id = "productCategoriesPanel";
  panel.className = "panel hidden";
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div><h2>Kategori Produk</h2><p class="muted">Kelola master kategori yang digunakan produk dan katalog Bos Pangan.</p></div>
      <button class="btn" type="button" id="reloadProductCategories">Muat Ulang</button>
    </div>
    <div id="productCategoryStatus" class="status" role="status" aria-live="polite">Menyiapkan modul kategori…</div>
    <form id="productCategoryForm" class="panel" style="background:#fbfcfe;border-color:#edf0f4">
      <h3 id="categoryFormTitle">Tambah kategori</h3>
      <div class="row">
        <label>Nama kategori<input name="name" maxlength="100" required placeholder="Contoh: Frozen Food"></label>
        <label>Slug URL<input name="slug" id="categorySlug" maxlength="120" placeholder="otomatis dari nama kategori"></label>
        <label>Icon / Emoji<input name="icon" maxlength="12" placeholder="Contoh: 🥩"></label>
      </div>
      <label>Deskripsi kategori<textarea name="description" rows="3" maxlength="500" placeholder="Penjelasan singkat kategori (opsional)"></textarea></label>
      <label style="display:flex;align-items:center;gap:8px;margin:12px 0"><input name="is_active" type="checkbox" checked style="width:auto"> Aktif dan dapat ditampilkan</label>
      <div class="row">
        <button class="btn primary" id="saveProductCategory" type="submit">Simpan Kategori</button>
        <button class="btn hidden" id="cancelCategoryEdit" type="button">Batal Edit</button>
      </div>
    </form>
    <h3>Daftar Kategori</h3>
    <div id="productCategoriesTable" class="table-wrap">Memuat kategori…</div>
  `;
  root.appendChild(panel);
  $("productCategoryForm").addEventListener("submit",submit);
  $("categorySlug").addEventListener("input",() => {
    if (!editingId) $("categorySlug").dataset.manual = "1";
  });
  $("productCategoryForm").elements.name.addEventListener("input",() => {
    if (!editingId && !$("categorySlug").dataset.manual) $("categorySlug").value = slugify($("productCategoryForm").elements.name.value);
  });
  $("cancelCategoryEdit").addEventListener("click",resetForm);
  $("reloadProductCategories").addEventListener("click",load);
}
mount();
window.addEventListener("cms:categories-open",() => {
  mount();
  $("productCategoriesPanel")?.classList.remove("hidden");
  load();
});
