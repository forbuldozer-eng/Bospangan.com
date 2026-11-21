const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString("id-ID");
const typeName = value => ({"tunggal/single":"Tunggal","olahan/produk/komposit":"Olahan / komposit"}[value] || value);
const element = (tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};

let foods = [], nutrientFields = [], page = 1, letter = "";
const baseTitle = document.title;

function renderList() {
  const term = $("query").value.trim().toLocaleLowerCase("id");
  const matches = foods.filter(food =>
    (!letter || food.nama_bahan.toUpperCase().startsWith(letter)) &&
    (!$("group").value || food.kelompok === $("group").value) &&
    (!$("type").value || food.jenis === $("type").value) &&
    [food.nama_bahan, food.kode, food.kode_lama, food.nama_daerah_lokal].some(v => v.toLocaleLowerCase("id").includes(term))
  );
  const size = Number($("size").value);
  const pages = Math.max(1, Math.ceil(matches.length / size));
  page = Math.max(1, Math.min(page, pages));
  const start = (page - 1) * size;
  $("results").replaceChildren();
  for (const food of matches.slice(start, start + size)) {
    const row = $("results").insertRow();
    const link = element("a", food.nama_bahan);
    link.href = "#" + food.kode;
    row.insertCell().append(link);
    for (const value of [food.kode, food.kelompok, typeName(food.jenis) || "—"]) row.insertCell().textContent = value;
  }
  $("count").textContent = matches.length ? fmt(start + 1) + "–" + fmt(Math.min(start + size, matches.length)) + " dari " + fmt(matches.length) + " bahan pangan" : "Tidak ada bahan yang cocok. Coba ubah pencarian atau filter.";
  $("position").textContent = page + " / " + pages;
  $("prev").disabled = page === 1;
  $("next").disabled = page === pages;
}

function renderRecord(food) {
  const record = $("record");
  record.replaceChildren();
  const heading = element("h1", food ? food.nama_bahan : "Kode pangan tidak ditemukan");
  record.append(heading);
  heading.tabIndex = -1;
  heading.focus();
  if (!food) return;
  record.prepend(element("small", "TKPI 2017 · " + food.kode));
  const info = element("dl", "");
  for (const [label,value] of [
    ["Kelompok",food.kelompok],["Tipe bahan",typeName(food.jenis)],["Nama ilmiah",food.nama_latin_spesies],
    ["Nama lokal / daerah",food.nama_daerah_lokal],["Nama Inggris",food.nama_inggris],["Keterangan",food.keterangan_masakan],
    ["Kode lama",food.kode_lama],["Sumber",food.sumber],["Halaman komposisi (PDF)",food.halaman_komposisi]
  ]) if (value) info.append(element("dt",label),element("dd",value));
  record.append(info, element("h2","Komposisi gizi"));
  if (!food.halaman_komposisi) {
    record.append(element("p","Entri ini tercantum dalam data pendamping. Angka komposisi gizi belum tersedia."));
    return;
  }
  record.append(element("p","Nilai per 100 g bagian yang dapat dimakan. Bagian yang dapat dimakan (BDD): " + (food.bdd_persen ? food.bdd_persen + "%" : "tidak tercantum") + "."));
  const table = element("table","");
  table.className = "nutrients";
  const header = table.createTHead().insertRow();
  header.append(element("th","Zat gizi"),element("th","Jumlah per 100 g"));
  const body = table.createTBody();
  const special = {vitamin_c:"Vitamin C",beta_karoten:"Beta-karoten",thiamin:"Tiamin (B1)",riboflavin:"Riboflavin (B2)",niasin:"Niasin (B3)"};
  for (const key of nutrientFields) {
    const split = key.lastIndexOf("_");
    const name = key.slice(0,split);
    const unit = key.slice(split+1);
    const row = body.insertRow();
    row.insertCell().textContent = special[name] || (name[0].toUpperCase() + name.slice(1)).replaceAll("_"," ");
    row.insertCell().textContent = food[key] ? food[key].replace(".",",") + " " + unit : "Tidak tercantum";
  }
  record.append(table);
}

function route() {
  const code = location.hash.slice(1);
  $("detail").hidden = !code;
  $("directory").hidden = Boolean(code);
  const food = foods.find(item => item.kode === code);
  document.title = food ? food.nama_bahan + " · Nilai Gizi | Bos Pangan" : baseTitle;
  if (code) renderRecord(food);
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
  $("print").onclick = () => window.print();
  window.addEventListener("hashchange",route);
  renderList();
  route();
}
init().catch(() => { $("count").textContent = "Data pangan gagal dimuat. Muat ulang halaman untuk mencoba kembali."; });
