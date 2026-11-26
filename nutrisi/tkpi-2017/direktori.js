const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString("id-ID");
const typeName = value => ({"tunggal/single":"Tunggal","olahan/produk/komposit":"Olahan / komposit"}[value] || value);
const element = (tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};
const slugify = value => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const detailPath = food => "/nutrisi/tkpi-2017/pangan/" +
  slugify(food.nama_bahan) + "-" + slugify(food.kode) + "/";

let foods = [], nutrientFields = [], page = 1, letter = "";
const baseTitle = document.title;

function renderList() {
  const term = $("query").value.trim().toLocaleLowerCase("id");
  const matches = foods.filter(food =>
    (!letter || food.nama_bahan.toUpperCase().startsWith(letter)) &&
    (!$("group").value || food.kelompok === $("group").value) &&
    (!$("type").value || food.jenis === $("type").value) &&
    [food.nama_bahan, food.kode, food.kode_lama, food.nama_daerah_lokal].some(v => String(v ?? "").toLocaleLowerCase("id").includes(term))
  );
  const size = Number($("size").value);
  const pages = Math.max(1, Math.ceil(matches.length / size));
  page = Math.max(1, Math.min(page, pages));
  const start = (page - 1) * size;
  $("results").replaceChildren();
  for (const food of matches.slice(start, start + size)) {
    const row = $("results").insertRow();
    const link = element("a", food.nama_bahan);
    link.href = detailPath(food);
    row.insertCell().append(link);
    for (const value of [food.kode, food.kelompok, typeName(food.jenis) || "—"]) row.insertCell().textContent = value;
  }
  $("count").textContent = matches.length ? fmt(start + 1) + "–" + fmt(Math.min(start + size, matches.length)) + " dari " + fmt(matches.length) + " bahan pangan" : "Tidak ada bahan yang cocok. Coba ubah pencarian atau filter.";
  $("position").textContent = page + " / " + pages;
  $("prev").disabled = page === 1;
  $("next").disabled = page === pages;
}

// Backward compatibility for previously shared #KODE URLs.
function routeLegacyHash() {
  const code = location.hash.slice(1);
  if (!code) return;
  const food = foods.find(item => item.kode === code);
  if (food) location.replace(detailPath(food));
}

async function init() {
  const response = await fetch("./pangan.json");
  if (!response.ok) throw new Error("Dataset unavailable");
  const {fields,foods:rows} = await response.json();
  foods = rows.map(row => Object.fromEntries(fields.map((key,i) => [key,row[i]])))
    .sort((a,b) => a.nama_bahan.localeCompare(b.nama_bahan,"id"));
  nutrientFields = fields.filter(field => /_(g|mg|mcg|kkal)$/.test(field));
  for (const [id,key] of [["group","kelompok"],["type","jenis"]]) {
    for (const val of [...new Set(foods.map(f=>f[key]).filter(Boolean))].sort()) {
      $(id).add(new Option(id === "type" ? typeName(val) : val,val));
    }
  }
  for (const initial of ["",..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]) {
    const button = element("button", initial || "Semua");
    button.type = "button";
    button.setAttribute("aria-pressed", String(initial === letter));
    button.onclick = () => {
      letter = initial;
      for (const b of $("alphabet").children) b.setAttribute("aria-pressed",String(b === button));
      page = 1;
      renderList();
    };
    $("alphabet").append(button);
  }
  const reset = () => { page = 1; renderList(); };
  $("filters").onsubmit = event => event.preventDefault();
  $("query").oninput = reset;
  for (const id of ["size","group","type"]) $(id).onchange = reset;
  $("prev").onclick = () => { page--; renderList(); };
  $("next").onclick = () => { page++; renderList(); };
  window.addEventListener("hashchange",routeLegacyHash);
  renderList();
  routeLegacyHash();
}
init().catch(() => { $("count").textContent = "Data pangan gagal dimuat. Muat ulang halaman untuk mencoba kembali."; });
