import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const slugify = value => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 180);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}


function markdownToEditorHtml(markdown) { return markdownPreview(markdown); }

function editorNodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\u00a0/g, " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag=node.tagName.toLowerCase();
  const children=Array.from(node.childNodes).map(editorNodeToMarkdown).join("");
  if(tag==="br") return "\n";
  if(tag==="strong"||tag==="b") return "**"+children+"**";
  if(tag==="em"||tag==="i") return "*"+children+"*";
  if(tag==="a"){const href=node.getAttribute("href")||"";return /^(https?:\/\/|\/)/i.test(href)?"["+children+"]("+href+")":children;}
  if(tag==="img"){const src=node.getAttribute("src")||"";const alt=node.getAttribute("alt")||"";return /^(https?:\/\/|\/)/i.test(src)?"!["+alt.replace(/[\[\]]/g," ")+"]("+src+")":"";}
  if(tag==="h2") return "\n\n## "+children+"\n\n";
  if(tag==="h3") return "\n\n### "+children+"\n\n";
  if(tag==="p"||tag==="div") return "\n\n"+children+"\n\n";
  if(tag==="ul"||tag==="ol"){const items=Array.from(node.children).filter(el=>el.tagName.toLowerCase()==="li");return "\n\n"+items.map((li,i)=>(tag==="ul"?"- ":(i+1)+". ")+Array.from(li.childNodes).map(editorNodeToMarkdown).join("")).join("\n")+"\n\n";}
  if(tag==="li") return children;
  if(tag==="blockquote") return "\n\n> "+children+"\n\n";
  if(tag==="hr") return "\n\n---\n\n";
  if(tag==="table") return "\n\n"+Array.from(node.querySelectorAll("tr")).map(row=>"| "+Array.from(row.children).map(cell=>cell.textContent.trim()).join(" | ")+" |").join("\n")+"\n\n";
  return children;
}

function syncVisualEditorToMarkdown() {
  const visual=$("articleVisualEditor"), field=$("articleContent");
  if(!visual||!field) return;
  field.value=Array.from(visual.childNodes).map(editorNodeToMarkdown).join("").replace(/\n{3,}/g,"\n\n").trim();
  field.dispatchEvent(new Event("input",{bubbles:true}));
}
function renderVisualEditorFromMarkdown() {
  const visual=$("articleVisualEditor"), field=$("articleContent");
  if(visual&&field) visual.innerHTML=markdownToEditorHtml(field.value);
}
function saveVisualSelection() {
  const visual=$("articleVisualEditor"), selection=window.getSelection();
  if(!visual||!selection||!selection.rangeCount) return;
  const range=selection.getRangeAt(0);
  if(visual.contains(range.commonAncestorContainer)) visual._savedRange=range.cloneRange();
}
function restoreVisualSelection() {
  const visual=$("articleVisualEditor");
  if(!visual) return;
  visual.focus();
  const selection=window.getSelection();
  if(visual._savedRange&&selection){selection.removeAllRanges();selection.addRange(visual._savedRange);}
}
function insertVisualHtml(html) {
  const visual=$("articleVisualEditor");if(!visual)return;
  restoreVisualSelection();document.execCommand("insertHTML",false,html);
  syncVisualEditorToMarkdown();saveVisualSelection();
}
function applyVisualCommand(command) {
  const visual=$("articleVisualEditor");if(!visual)return;
  restoreVisualSelection();
  const commands={bold:"bold",italic:"italic",ul:"insertUnorderedList",ol:"insertOrderedList"};
  if(command==="h2"||command==="h3") document.execCommand("formatBlock",false,command);
  else if(commands[command]) document.execCommand(commands[command],false,null);
  else if(command==="quote") document.execCommand("formatBlock",false,"blockquote");
  else if(command==="hr") document.execCommand("insertHorizontalRule",false,null);
  else if(command==="link"){
    const selected=window.getSelection()?.toString()||"";
    if(!selected){window.alert("Pilih dahulu kata atau kalimat yang akan dijadikan hyperlink.");return;}
    const href=window.prompt("Masukkan URL internal (/blog/...) atau eksternal (https://...):");
    if(!href)return;
    if(!/^(https?:\/\/|\/)/i.test(href.trim())||/^\/\//.test(href.trim())){window.alert("URL tidak valid.");return;}
    document.execCommand("createLink",false,href.trim());
    const sel=window.getSelection();if(sel?.anchorNode){const a=sel.anchorNode.parentElement?.closest("a");if(a){a.style.color="#1769d2";a.style.textDecoration="underline";a.target="_blank";a.rel="noopener noreferrer";}}
  } else if(command==="image"){
    const alt=window.prompt("Masukkan alt text gambar:");if(alt===null)return;
    const src=window.prompt("Masukkan URL gambar:");if(!src)return;
    if(!/^(https?:\/\/|\/)/i.test(src.trim())||/^\/\//.test(src.trim())){window.alert("URL gambar tidak valid.");return;}
    insertVisualHtml('<img src="'+escapeHtml(src.trim())+'" alt="'+escapeHtml(alt)+'" style="max-width:100%;height:auto;border-radius:8px">');return;
  } else if(command==="table"){
    insertVisualHtml("<table><tbody><tr><th>Kolom 1</th><th>Kolom 2</th></tr><tr><td>Isi 1</td><td>Isi 2</td></tr></tbody></table>");return;
  }
  syncVisualEditorToMarkdown();saveVisualSelection();
}

function markdownPreview(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let listType = null;
  const closeList = () => { if (listType) { html.push(listType === "ol" ? "</ol>" : "</ul>"); listType = null; } };
  const inline = value => {
    let out = escapeHtml(value);
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, source) => {
      const src = source.trim();
      if (!/^(https?:\/\/|\/)/i.test(src)) return escapeHtml(alt);
      return '<img class="article-preview-image" src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy">';
    });
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      const safeHref = href.trim();
      return /^(https?:\/\/|\/)/i.test(safeHref)
        ? '<a href="' + escapeHtml(safeHref) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>"
        : label;
    });
    return out;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    const galleryOnly = /^(?:!\[[^\]]*\]\((?:https?:\/\/|\/)[^)]+\)\s*){2,}$/.test(line);
    if (galleryOnly) {
      closeList();
      html.push('<div class="article-preview-gallery">' + inline(line) + "</div>");
    } else if (heading) { closeList(); const level=heading[1].length; html.push("<h"+level+">"+inline(heading[2])+"</h"+level+">"); }
    else if (/^---+$/.test(line)) { closeList(); html.push("<hr>"); }
    else if (line.startsWith(">")) { closeList(); html.push("<blockquote>"+inline(line.replace(/^>\s?/, ""))+"</blockquote>"); }
    else if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (listType !== type) { closeList(); html.push("<"+type+">"); listType=type; }
      html.push("<li>"+inline((bullet || numbered)[1])+"</li>");
    } else { closeList(); html.push("<p>"+inline(line)+"</p>"); }
  }
  closeList();
  return html.join("");
}
let editorHistory = [];
let editorHistoryIndex = -1;
let editorHistoryRestoring = false;
let editorHistoryLastInputAt = 0;

function getEditorState(field) {
  return { value: field.value, start: field.selectionStart, end: field.selectionEnd };
}

function recordEditorState(force = false) {
  const field = $("articleContent");
  if (!field || editorHistoryRestoring) return;
  const state = getEditorState(field);
  const current = editorHistory[editorHistoryIndex];
  if (current && current.value === state.value) {
    editorHistory[editorHistoryIndex] = state;
    return;
  }
  const now = Date.now();
  if (!force && current && editorHistoryIndex === editorHistory.length - 1 && now - editorHistoryLastInputAt < 800) {
    editorHistory[editorHistoryIndex] = state;
  } else {
    editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
    editorHistory.push(state);
    if (editorHistory.length > 100) editorHistory.shift();
    editorHistoryIndex = editorHistory.length - 1;
  }
  editorHistoryLastInputAt = now;
  updateEditorHistoryButtons();
}

function updateEditorHistoryButtons() {
  const undo = document.querySelector('[data-editor-history="undo"]');
  const redo = document.querySelector('[data-editor-history="redo"]');
  if (undo) undo.disabled = editorHistoryIndex <= 0;
  if (redo) redo.disabled = editorHistoryIndex < 0 || editorHistoryIndex >= editorHistory.length - 1;
}

function restoreEditorHistory(index) {
  const field = $("articleContent");
  const state = editorHistory[index];
  if (!field || !state) return;
  editorHistoryIndex = index;
  editorHistoryRestoring = true;
  field.value = state.value;
  field.focus();
  field.setSelectionRange(Math.min(state.start, field.value.length), Math.min(state.end, field.value.length));
  field.dispatchEvent(new Event("input", { bubbles: true }));
  renderVisualEditorFromMarkdown();
  editorHistoryRestoring = false;
  updateEditorHistoryButtons();
}

function resetEditorHistory() {
  const field=$("articleContent");
  editorHistory=field?[getEditorState(field)]:[];
  editorHistoryIndex=editorHistory.length?0:-1;
  editorHistoryLastInputAt=0;
  updateEditorHistoryButtons();
}

function undoArticleEdit() {
  if (editorHistoryIndex > 0) restoreEditorHistory(editorHistoryIndex - 1);
}

function redoArticleEdit() {
  if (editorHistoryIndex < editorHistory.length - 1) restoreEditorHistory(editorHistoryIndex + 1);
}

function applyEditorEdit(value, start, end) {
  const field = $("articleContent");
  if (!field) return;
  field.setRangeText(value, start, end, "end");
  editorHistoryLastInputAt=0;
  field.focus();
  field.dispatchEvent(new Event("input", { bubbles: true }));
  recordEditorState(true);
}

function insertHyperlink() {
  const field = $("articleContent");
  if (!field) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const selected = field.value.slice(start, end);
  const label = selected || window.prompt("Teks keyword atau kalimat yang akan dijadikan hyperlink:");
  if (!label) return;
  const destination = window.prompt("Masukkan URL tujuan (internal: /blog/slug/ atau eksternal: https://...):");
  if (!destination) return;
  const href = destination.trim();
  if (!/^(https?:\/\/|\/)/i.test(href) || /^\/\//.test(href)) {
    window.alert("URL harus berupa alamat https:// atau path internal yang diawali /.");
    return;
  }
  const markdown = "[" + label.replace(/[\[\]]/g, "") + "](" + href.replace(/[\s()]/g, encodeURIComponent) + ")";
  applyEditorEdit(markdown, start, end);
}

function insertMarkdown(command) {
  if ($("articleVisualEditor")) { applyVisualCommand(command); return; }
  const field = $("articleContent");
  if (!field) return;
  if (command === "link") return insertHyperlink();
  const templates = {
    h2:"## Judul Bagian", h3:"### Subjudul", bold:"**teks tebal**",
    italic:"*teks miring*", ul:"- Item daftar", ol:"1. Item daftar",
    quote:"> Kutipan",
    image:"![deskripsi gambar](https://alamat-gambar)", table:"| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Isi 1 | Isi 2 |",
    hr:"\n---\n"
  };
  const value=templates[command] || "";
  const start=field.selectionStart, end=field.selectionEnd;
  applyEditorEdit(value,start,end);
}
function plainArticleText(markdown) {
  return String(markdown || "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[>*_\x60|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text, phrase) {
  const haystack=String(text || "").toLocaleLowerCase("id-ID");
  const needle=String(phrase || "").toLocaleLowerCase("id-ID").trim();
  if (!needle) return 0;
  let count=0, index=0;
  while ((index=haystack.indexOf(needle,index)) !== -1) {
    count++;
    index += needle.length;
  }
  return count;
}

function seoCheck(label, state, detail) {
  return '<li class="'+state+'"><span><strong>'+escapeHtml(label)+'</strong><br>'+escapeHtml(detail)+'</span></li>';
}

function setSeoScore(prefix, score, summary) {
  const wrap=$(prefix==="seo" ? "seoScoreValue" : "readabilityScoreValue");
  const bar=$(prefix==="seo" ? "seoScoreBar" : "readabilityScoreBar");
  const box=bar?.closest(".seo-score-wrap");
  if (wrap) wrap.textContent=score+"/100";
  if (bar) bar.style.width=score+"%";
  if (box) box.dataset.level=score>=75?"good":score>=50?"warning":"bad";
  const note=$(prefix==="seo" ? "seoScoreSummary" : "readabilitySummary");
  if (note) note.textContent=summary;
}

function syncArticleMeta() {
  const form=$("articleForm");
  if (!form) return;
  const f=form.elements;
  const title=f.title.value.trim();
  const excerpt=f.excerpt.value.trim();
  const seoTitle=f.seo_title.value.trim() || title || "Judul artikel akan tampil di sini";
  const seoDescription=f.seo_description.value.trim() || excerpt || "Deskripsi artikel akan tampil di sini.";
  const content=f.content_markdown.value;
  const keyphrase=(f.focus_keyphrase?.value || "").trim();
  const words=content.trim() ? content.trim().split(/\s+/).length : 0;
  const text=plainArticleText(content);
  const lower=text.toLocaleLowerCase("id-ID");
  const phraseCount=countMatches(text,keyphrase);
  const density=words ? phraseCount/words*100 : 0;
  const headings=[...content.matchAll(/^\s{0,3}(#{1,3})\s+(.+)$/gm)];
  const firstParagraph=(content.split(/\n\s*\n/).find(x=>x.trim() && !/^\s{0,3}#/.test(x)) || "");
  const titleLength=seoTitle.length, descLength=f.seo_description.value.trim().length;
  const internalLinks=(content.match(/\]\((?:\/|https?:\/\/bospangan\.com)/gi)||[]).length;
  const externalLinks=(content.match(/\]\(https?:\/\//gi)||[]).length-internalLinks;
  const imageMatches=[...content.matchAll(/!\[([^\]]*)\]\([^)]+\)/g)];
  const hasFeaturedImage=!!(f.featured_image.files?.[0] || editingArticle?.featured_image_url);
  const featuredAlt=(f.featured_image_alt?.value || "").trim();
  const sentences=text.split(/[.!?]+/).map(x=>x.trim()).filter(Boolean);
  const avgSentence=sentences.length ? text.split(/\s+/).length/sentences.length : 0;
  const paragraphs=content.split(/\n\s*\n/).map(p=>plainArticleText(p)).filter(Boolean);
  const longParagraphs=paragraphs.filter(p=>p.split(/\s+/).length>120).length;
  const transitions=["namun","selain itu","oleh karena itu","karena itu","dengan demikian","misalnya","sebagai contoh","selanjutnya","pertama","berikutnya","akhirnya","meskipun","sementara itu","di sisi lain","sehingga","akibatnya"];
  const transitionCount=transitions.reduce((sum,w)=>sum+(lower.match(new RegExp("\\b"+w+"\\b","g"))||[]).length,0);
  const checks=[];
  let score=0;
  const add=(label,ok,detail,points=100/14)=>{score+=ok?points:0;checks.push(seoCheck(label,ok?"good":"warn",detail));};
  add("Frasa kunci utama",!!keyphrase, keyphrase?"Frasa kunci sudah ditentukan.":"Tambahkan frasa kunci utama untuk menganalisis relevansi.");
  add("Frasa kunci di judul",!!keyphrase && countMatches(title,keyphrase)>0,keyphrase?"Pastikan frasa kunci muncul secara alami di judul.":"Belum ada frasa kunci.");
  add("Frasa kunci di URL",!!keyphrase && countMatches(f.slug.value.replace(/-/g," "),keyphrase)>0,keyphrase?"Gunakan frasa kunci di slug bila tetap terbaca alami.":"Belum ada frasa kunci.");
  add("Frasa kunci di pembuka",!!keyphrase && countMatches(firstParagraph,keyphrase)>0,keyphrase?"Sebaiknya frasa utama muncul di paragraf pembuka.":"Belum ada frasa kunci.");
  add("Frasa kunci dalam isi",!!keyphrase && phraseCount>=2,keyphrase?(phraseCount+" kemunculan terdeteksi; gunakan secara alami, jangan dipaksakan."):"Belum ada frasa kunci.");
  add("Kepadatan frasa kunci",!!keyphrase && density>=0.5 && density<=2.5,"Kepadatan saat ini "+density.toFixed(2)+"%; hindari pengulangan berlebihan.");
  add("SEO Title",titleLength>=30 && titleLength<=60,"Panjang saat ini "+titleLength+" karakter; target panduan 30–60 karakter.");
  add("Meta Description",descLength>=120 && descLength<=160,"Panjang saat ini "+descLength+" karakter; target panduan 120–160 karakter.");
  add("Panjang artikel",words>=300,"Jumlah saat ini "+words+" kata; artikel informatif umumnya membutuhkan konteks yang cukup.");
  add("Subheading",headings.length>=2,"Ditemukan "+headings.length+" heading Markdown; gunakan beberapa subheading untuk membagi topik.");
  add("Tautan internal",internalLinks>=2,"Ditemukan "+internalLinks+" tautan internal; hubungkan artikel dengan halaman relevan Bos Pangan.");
  add("Gambar dalam isi dengan alt text",imageMatches.length>0 && imageMatches.every(m=>m[1].trim().length>0),"Ditemukan "+imageMatches.length+" gambar Markdown; isi teks alternatif deskriptif pada setiap gambar.");
  add("Alt text gambar unggulan",!hasFeaturedImage || !!featuredAlt,hasFeaturedImage?(featuredAlt?"Alt text gambar unggulan sudah diisi.":"Tambahkan alt text yang menjelaskan gambar unggulan."):"Belum ada gambar unggulan; pemeriksaan ini tidak diwajibkan.");
  add("Frasa kunci pada SEO title",!!keyphrase && countMatches(seoTitle,keyphrase)>0,keyphrase?"Masukkan frasa utama ke SEO Title bila sesuai.":"Belum ada frasa kunci.");
  score=Math.round(score);
  $("seoChecks").innerHTML=checks.join("");
  setSeoScore("seo",score,score>=80?"Optimasi dasar sudah kuat. Periksa kembali kualitas dan akurasi konten.":score>=55?"Masih ada beberapa rekomendasi SEO yang perlu ditindaklanjuti.":"Lengkapi frasa kunci dan elemen dasar SEO.");
  const readability=[];
  let readScore=100;
  const addRead=(label,ok,detail,penalty)=>{if(!ok)readScore-=penalty;readability.push(seoCheck(label,ok?"good":"warn",detail));};
  addRead("Panjang kalimat",avgSentence>0 && avgSentence<=20,"Rata-rata "+(avgSentence?avgSentence.toFixed(1):"0")+" kata per kalimat; usahakan sekitar 20 kata atau kurang.",18);
  addRead("Panjang paragraf",paragraphs.length>0 && longParagraphs===0,longParagraphs?"Ada "+longParagraphs+" paragraf lebih dari 120 kata.":"Panjang paragraf terdeteksi cukup ringkas.",18);
  addRead("Kata transisi",transitionCount>=Math.max(2,Math.round(sentences.length*0.08)),transitionCount+" penggunaan kata/frasa transisi terdeteksi.",14);
  addRead("Struktur subheading",headings.length>=2,"Ditemukan "+headings.length+" subheading untuk membantu pemindaian konten.",18);
  addRead("Kalimat dan paragraf",sentences.length>=4 && paragraphs.length>=3,"Ditemukan "+sentences.length+" kalimat dan "+paragraphs.length+" blok paragraf.",16);
  readScore=Math.max(0,Math.min(100,readScore));
  $("readabilityChecks").innerHTML=readability.join("");
  setSeoScore("readability",readScore,readScore>=80?"Struktur tulisan cukup mudah dipindai.":readScore>=60?"Perbaiki beberapa bagian agar lebih nyaman dibaca.":"Pecah paragraf dan sederhanakan kalimat.");
  $("articleWordCount").textContent=words+" kata · "+content.length+" karakter";
  $("seoPreviewTitle").textContent=seoTitle;
  $("seoPreviewDescription").textContent=seoDescription;
  $("seoTitleMeter").style.width=Math.min(100,(titleLength/60)*100)+"%";
  $("seoDescriptionMeter").style.width=Math.min(100,(descLength/155)*100)+"%";
  $("seoTitleLength").textContent=titleLength+" karakter";
  $("seoDescriptionLength").textContent=descLength+" karakter";
}


let initialized = false;
let currentUser = null;
let editingArticle = null;
let articleGalleryQueue = [];

function setStatus(message, isError = false) {
  const node = $("articleStatus");
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#a12626" : "";
  node.style.background = isError ? "#fff0f0" : "";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}

function showEditor(show = true) {
  $("articleEditor").classList.toggle("hidden", !show);
  if (show) $("articleEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEditor() {
  editingArticle = null;
  $("articleForm").reset();
  $("articleForm").elements.id.value = "";
  $("articleForm").elements.slug.dataset.manual = "false";
  if ($("articleVisualEditor")) $("articleVisualEditor").innerHTML = "";
  resetEditorHistory();
  $("articleImagePreview").textContent = "Belum ada gambar utama.";
  $("articleForm").querySelector('button[type="submit"]').textContent = "Simpan Artikel";
  showEditor(false);
}

function showImage(url, altText = "") {
  const root = $("articleImagePreview");
  root.replaceChildren();
  if (!url) {
    root.textContent = "Belum ada gambar utama.";
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = altText || "Pratinjau gambar utama artikel";
  image.loading = "lazy";
  image.style.cssText = "display:block;width:min(260px,100%);max-height:180px;object-fit:cover;border-radius:8px;margin:8px 0";
  image.onerror = () => { root.textContent = "Gambar tidak dapat dimuat."; };
  root.append(image);
}

async function uploadFeaturedImage(file) {
  if (!file) return editingArticle?.featured_image_url || null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Gambar harus berformat JPG, PNG, atau WebP.");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 8 MB.");
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  const path = currentUser.id + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await db.storage.from("cms-article-images").upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  const { data } = db.storage.from("cms-article-images").getPublicUrl(path);
  return data.publicUrl;
}

function renderArticleGalleryQueue() {
  const panel = $("articleGalleryQueue");
  const list = $("articleGalleryItems");
  if (!panel || !list) return;
  panel.classList.toggle("hidden", articleGalleryQueue.length === 0);
  list.replaceChildren();
  articleGalleryQueue.forEach((item, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #e2e8f0";
    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "";
    image.style.cssText = "width:64px;height:56px;object-fit:cover;border-radius:7px";
    const fields = document.createElement("div");
    const filename = document.createElement("small");
    filename.textContent = item.file.name;
    filename.style.cssText = "display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;margin-bottom:5px";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 250;
    input.value = item.alt;
    input.placeholder = "Alt text deskriptif untuk foto ini";
    input.setAttribute("aria-label", "Alt text foto " + (index + 1));
    input.style.cssText = "width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:7px";
    input.addEventListener("input", () => { articleGalleryQueue[index].alt = input.value; });
    fields.append(filename, input);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn";
    remove.textContent = "Hapus";
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(articleGalleryQueue[index].previewUrl);
      articleGalleryQueue.splice(index, 1);
      renderArticleGalleryQueue();
    });
    row.append(image, fields, remove);
    list.append(row);
  });
  $("insertArticleGallery").disabled = articleGalleryQueue.length === 0;
}

function queueArticleGalleryFiles(files) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const incoming = Array.from(files || []);
  if (!incoming.length) return;
  if (articleGalleryQueue.length + incoming.length > 12) {
    setStatus("Maksimal 12 foto dalam satu batch galeri.", true);
    return;
  }
  for (const file of incoming) {
    if (!allowed.includes(file.type)) {
      setStatus("File " + file.name + " bukan JPG, PNG, atau WebP.", true);
      continue;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus("Ukuran " + file.name + " melebihi 8 MB.", true);
      continue;
    }
    const suggestedAlt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    articleGalleryQueue.push({ file, alt: suggestedAlt, previewUrl: URL.createObjectURL(file) });
  }
  renderArticleGalleryQueue();
  if (articleGalleryQueue.length) setStatus(articleGalleryQueue.length + " foto siap ditambahkan. Periksa alt text setiap foto.");
}

async function uploadGalleryImage(file) {
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  const path = currentUser.id + "/gallery/" + crypto.randomUUID() + "." + extension;
  const { error } = await db.storage.from("cms-article-images").upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  const { data } = db.storage.from("cms-article-images").getPublicUrl(path);
  return data.publicUrl;
}

async function insertArticleGallery() {
  if (!articleGalleryQueue.length) return;
  const button = $("insertArticleGallery");
  button.disabled = true;
  button.textContent = "Mengunggah foto…";
  try {
    const images = [];
    for (const item of articleGalleryQueue) {
      const alt = item.alt.trim();
      if (!alt) throw new Error("Alt text wajib diisi untuk setiap foto galeri.");
      const url = await uploadGalleryImage(item.file);
      const safeAlt = alt.replace(/[\[\]]/g, " ").replace(/[\r\n]+/g, " ").trim();
      images.push("![" + safeAlt + "](" + url + ")");
    }
    const field = $("articleContent");
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const prefix = start > 0 && !field.value.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const suffix = end < field.value.length && !field.value.slice(end).startsWith("\n\n") ? "\n\n" : "";
    applyEditorEdit(prefix + images.join(" ") + suffix, start, end);
    articleGalleryQueue.forEach(item => URL.revokeObjectURL(item.previewUrl));
    articleGalleryQueue = [];
    $("articleGalleryFiles").value = "";
    renderArticleGalleryQueue();
    setStatus(images.length + " foto berhasil diunggah dan dimasukkan ke artikel.");
  } catch (error) {
    setStatus("Gagal memasukkan galeri: " + (error.message || error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Unggah & Sisipkan Galeri";
  }
}

function editArticle(article) {
  editingArticle = article;
  const form = $("articleForm");
  const f = form.elements;
  f.id.value = article.id;
  f.title.value = article.title || "";
  f.slug.value = article.slug || "";
  f.slug.dataset.manual = "true";
  f.excerpt.value = article.excerpt || "";
  f.content_markdown.value = article.content_markdown || "";
  renderVisualEditorFromMarkdown();
  resetEditorHistory();
  f.seo_title.value = article.seo_title || "";
  f.focus_keyphrase.value = article.focus_keyphrase || "";
  f.seo_description.value = article.seo_description || "";
  f.status.value = article.status || "draft";
  f.featured_image.value = "";
  f.featured_image_alt.value = article.featured_image_alt || "";
  showImage(article.featured_image_url, f.featured_image_alt.value);
  form.querySelector('button[type="submit"]').textContent = "Perbarui Artikel";
  showEditor(true);
}

async function loadArticles() {
  setStatus("Memuat daftar artikel...");
  const { data, error } = await db.from("cms_articles")
    .select("id,title,slug,excerpt,content_markdown,featured_image_url,featured_image_alt,seo_title,seo_description,focus_keyphrase,status,published_at,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const target = $("articlesTable");
  if (!data?.length) {
    target.innerHTML = '<p class="muted">Belum ada artikel. Klik “Artikel Baru” untuk membuat artikel pertama.</p>';
    setStatus("Belum ada artikel.");
    return;
  }

  target.innerHTML = '<table><thead><tr><th>Artikel</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody>' +
    data.map(article => '<tr>' +
      '<td><strong>' + esc(article.title) + '</strong><br><small>/' + esc(article.slug) + '</small></td>' +
      '<td>' + (article.status === "published" ? '<span style="color:#16834d;font-weight:700">Terbit</span>' : '<span style="color:#9a6a12;font-weight:700">Draft</span>') + '</td>' +
      '<td>' + esc(formatDate(article.updated_at)) + '</td>' +
      '<td><button class="btn" type="button" data-edit-article="' + esc(article.id) + '">Edit</button> ' +
      '<button class="btn" type="button" data-delete-article="' + esc(article.id) + '">Hapus</button></td>' +
    '</tr>').join("") + '</tbody></table>';

  target.querySelectorAll("[data-edit-article]").forEach(button => {
    button.addEventListener("click", () => editArticle(data.find(x => x.id === button.dataset.editArticle)));
  });
  target.querySelectorAll("[data-delete-article]").forEach(button => {
    button.addEventListener("click", async () => {
      const article = data.find(x => x.id === button.dataset.deleteArticle);
      if (!article || !confirm('Hapus artikel "' + article.title + '"? Tindakan ini tidak dapat dibatalkan.')) return;
      button.disabled = true;
      const { error: deleteError } = await db.from("cms_articles").delete().eq("id", article.id);
      if (deleteError) {
        setStatus("Gagal menghapus artikel: " + deleteError.message, true);
        button.disabled = false;
        return;
      }
      if (article.featured_image_url) {
        const prefix = new URL(SUPABASE_URL).origin + "/storage/v1/object/public/cms-article-images/";
        if (article.featured_image_url.startsWith(prefix)) {
          const path = decodeURIComponent(article.featured_image_url.slice(prefix.length));
          await db.storage.from("cms-article-images").remove([path]);
        }
      }
      if (editingArticle?.id === article.id) resetEditor();
      setStatus("Artikel berhasil dihapus.");
      await loadArticles();
    });
  });
  setStatus(data.length + " artikel berhasil dimuat.");
}

async function saveArticle(forceDraft = false) {
  const form = $("articleForm");
  const f = form.elements;
  const title = f.title.value.trim();
  const slug = slugify(f.slug.value);
  const content = f.content_markdown.value.trim();
  if (!title || !slug || !content) throw new Error("Judul, slug, dan isi artikel wajib diisi.");
  if (slug !== f.slug.value.trim()) throw new Error("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");

  const status = forceDraft ? "draft" : f.status.value;
  const imageFile = f.featured_image.files?.[0] || null;
  const imageUrl = await uploadFeaturedImage(imageFile);
  const now = new Date().toISOString();
  const wasPublished = editingArticle?.status === "published";
  const payload = {
    title,
    slug,
    excerpt: f.excerpt.value.trim(),
    content_markdown: content,
    featured_image_url: imageUrl,
    featured_image_alt: f.featured_image_alt.value.trim(),
    seo_title: f.seo_title.value.trim(),
    seo_description: f.seo_description.value.trim(),
    focus_keyphrase: f.focus_keyphrase.value.trim(),
    status,
    published_at: status === "published" ? (editingArticle?.published_at || now) : null,
    updated_by: currentUser.id,
    updated_at: now
  };

  if (editingArticle) {
    const { error } = await db.from("cms_articles").update(payload).eq("id", editingArticle.id);
    if (error) throw error;
    if (imageFile && editingArticle.featured_image_url && editingArticle.featured_image_url !== imageUrl) {
      const prefix = new URL(SUPABASE_URL).origin + "/storage/v1/object/public/cms-article-images/";
      if (editingArticle.featured_image_url.startsWith(prefix)) {
        const oldPath = decodeURIComponent(editingArticle.featured_image_url.slice(prefix.length));
        await db.storage.from("cms-article-images").remove([oldPath]);
      }
    }
  } else {
    payload.created_by = currentUser.id;
    const { error } = await db.from("cms_articles").insert(payload);
    if (error) throw error;
  }

  resetEditor();
  setStatus(status === "published" ? "Artikel berhasil diterbitkan." : "Artikel berhasil disimpan sebagai draft.");
  await loadArticles();
}

async function initialize() {
  if (initialized) return;
  initialized = true;
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError || !session) {
    setStatus("Sesi login tidak ditemukan. Silakan login kembali.", true);
    return;
  }
  currentUser = session.user;
  const { data: profile, error } = await db.from("profiles")
    .select("role").eq("id", currentUser.id).single();
  if (error || !["admin", "super_admin"].includes(profile?.role)) {
    setStatus("Akses ditolak. Modul artikel hanya untuk Admin dan Super Admin.", true);
    return;
  }

  $("newArticleButton").addEventListener("click", () => {
    resetEditor();
    showEditor(true);
    $("articleForm").elements.title.focus();
  });
  $("cancelArticleEdit").addEventListener("click", resetEditor);
  $("refreshArticles").addEventListener("click", () => loadArticles().catch(error => setStatus(error.message, true)));
  $("articleForm").elements.title.addEventListener("input", event => {
    const slug = $("articleForm").elements.slug;
    if (slug.dataset.manual !== "true") slug.value = slugify(event.target.value);
  });
  $("articleForm").elements.slug.addEventListener("input", event => {
    event.target.dataset.manual = "true";
  });
  $("articleForm").elements.featured_image.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return showImage(editingArticle?.featured_image_url, $("articleForm").elements.featured_image_alt.value);
    showImage(URL.createObjectURL(file), $("articleForm").elements.featured_image_alt.value);
  });
  $("articleForm").elements.featured_image_alt.addEventListener("input", event => {
    const file = $("articleForm").elements.featured_image.files?.[0];
    const url = file ? URL.createObjectURL(file) : editingArticle?.featured_image_url;
    showImage(url, event.target.value);
    syncArticleMeta();
  });
  $("cancelArticleEditSide").addEventListener("click", resetEditor);
  $("backToArticleList").addEventListener("click", () => {
    resetEditor();
    $("articleListPanel").scrollIntoView({behavior:"smooth",block:"start"});
  });
  document.querySelectorAll("[data-md]").forEach(button => {
    button.addEventListener("click", () => insertMarkdown(button.dataset.md));
  });
  document.querySelector("[data-gallery-trigger]")?.addEventListener("mousedown", saveVisualSelection);
  document.querySelector("[data-gallery-trigger]")?.addEventListener("click", () => $("articleGalleryFiles")?.click());
  $("articleGalleryFiles").addEventListener("change", event => {
    queueArticleGalleryFiles(event.target.files);
    event.target.value = "";
  });
  $("cancelArticleGallery").addEventListener("click", () => {
    articleGalleryQueue.forEach(item => URL.revokeObjectURL(item.previewUrl));
    articleGalleryQueue = [];
    renderArticleGalleryQueue();
  });
  $("insertArticleGallery").addEventListener("click", insertArticleGallery);
  const contentField=$("articleContent");
  const preview=$("articleContentPreview");
  const toolbar=$("articleContent").closest(".editor-shell")?.querySelector(".editor-toolbar");
  if (toolbar && !toolbar.querySelector("[data-editor-history]")) {
    const undoButton=document.createElement("button");
    undoButton.type="button";
    undoButton.className="editor-tool";
    undoButton.textContent="↶";
    undoButton.title="Undo (Ctrl+Z)";
    undoButton.setAttribute("aria-label","Undo perubahan");
    undoButton.dataset.editorHistory="undo";
    undoButton.addEventListener("click",undoArticleEdit);
    const redoButton=document.createElement("button");
    redoButton.type="button";
    redoButton.className="editor-tool";
    redoButton.textContent="↷";
    redoButton.title="Redo (Ctrl+Y)";
    redoButton.setAttribute("aria-label","Redo perubahan");
    redoButton.dataset.editorHistory="redo";
    redoButton.addEventListener("click",redoArticleEdit);
    toolbar.prepend(redoButton);
    toolbar.prepend(undoButton);
  }
  editorHistory=[getEditorState(contentField)];
  editorHistoryIndex=0;
  updateEditorHistoryButtons();
  contentField.addEventListener("input",()=>{ if(!editorHistoryRestoring) recordEditorState(false); });
  contentField.addEventListener("keydown",event=>{
    const mod=event.ctrlKey||event.metaKey;
    if(!mod) return;
    const key=event.key.toLowerCase();
    if(key==="z" && event.shiftKey){event.preventDefault();redoArticleEdit();}
    else if(key==="z"){event.preventDefault();undoArticleEdit();}
    else if(key==="y"){event.preventDefault();redoArticleEdit();}
  });
  if(!document.getElementById("bosArticlePreviewStyles")){
    const style=document.createElement("style");
    style.id="bosArticlePreviewStyles";
    style.textContent=".editor-preview .article-preview-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.editor-preview .article-preview-image{max-width:100%;height:auto;max-height:360px;object-fit:contain;border-radius:10px;vertical-align:middle}.editor-preview .article-preview-gallery img{width:100%;height:240px;object-fit:cover;border-radius:10px}.editor-preview .article-preview-gallery img:only-child{grid-column:1/-1}@media(max-width:640px){.editor-preview .article-preview-gallery{grid-template-columns:1fr}.editor-preview .article-preview-gallery img{height:auto;max-height:360px}}";
    document.head.append(style);
  }
  const visualEditor=$("articleVisualEditor");
  if(visualEditor){
    visualEditor.addEventListener("input",syncVisualEditorToMarkdown);
    visualEditor.addEventListener("keyup",saveVisualSelection);
    visualEditor.addEventListener("mouseup",saveVisualSelection);
    visualEditor.addEventListener("keydown",event=>{const mod=event.ctrlKey||event.metaKey;if(mod&&["z","y"].includes(event.key.toLowerCase())){event.preventDefault();event.key.toLowerCase()==="y"||event.shiftKey?redoArticleEdit():undoArticleEdit();}});
    toolbar?.addEventListener("mousedown",event=>{if(event.target.closest("button")){saveVisualSelection();event.preventDefault();}});
  }
  $("articleVisualTab").addEventListener("click", () => {
    contentField.classList.add("hidden");
    visualEditor?.classList.remove("hidden");
    preview.classList.add("hidden");
  });
  $("articlePreviewTab").addEventListener("click", () => {
    syncVisualEditorToMarkdown();
    preview.innerHTML=markdownPreview(contentField.value);
    contentField.classList.add("hidden");
    visualEditor?.classList.add("hidden");
    preview.classList.remove("hidden");
  });
  ["title","excerpt","content_markdown","seo_title","seo_description","focus_keyphrase","slug"].forEach(name => {
    $( "articleForm" ).elements[name].addEventListener("input", syncArticleMeta);
  });
  syncArticleMeta();

  $("saveArticleDraft").addEventListener("click", async () => {
    const button = $("saveArticleDraft");
    button.disabled = true;
    try { await saveArticle(true); }
    catch (error) { setStatus("Gagal menyimpan draft: " + (error.message || error), true); }
    finally { button.disabled = false; }
  });
  $("articleForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await saveArticle(false); }
    catch (error) { setStatus("Gagal menyimpan artikel: " + (error.message || error), true); }
    finally { button.disabled = false; }
  });

  await loadArticles();
}

window.addEventListener("cms:articles-open", () => {
  initialize().catch(error => setStatus("Modul artikel gagal dimuat: " + (error.message || error), true));
});
