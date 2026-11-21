import{createClient}from"https://esm.sh/@supabase/supabase-js@2";import{SUPABASE_URL,SUPABASE_ANON_KEY}from"/auth-config.js";const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY),$=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),slugify=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180);let user=null,edit=null,ready=false;
function say(t,b=false){if($("blogCmsStatus")){$("blogCmsStatus").textContent=t;$("blogCmsStatus").style.color=b?"#b42318":"#17633f"}}
function mount(){if($("blogCmsPanel"))return;const style=document.createElement("style");style.id="blogEditorToolbarStyles";style.textContent=".blog-editor-toolbar{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.blog-tool-group{display:flex;flex-wrap:wrap;gap:5px;padding:5px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}.blog-editor-toolbar .btn{min-height:36px;padding:7px 10px}.blog-link-dialog[hidden]{display:none}.blog-link-dialog{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px}.blog-link-backdrop{position:absolute;inset:0;background:#0f172a99}.blog-link-card{position:relative;width:min(560px,100%);max-height:min(80vh,700px);overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 60px #0003}.blog-link-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.blog-link-head h3{margin:0}.blog-link-card p{color:#64748b;font-size:13px}.blog-link-card input{width:100%;padding:12px;border:1px solid #dbe3ec;border-radius:9px;margin:10px 0}.blog-link-results{display:grid;gap:7px;max-height:44vh;overflow:auto}.blog-link-result{display:grid;text-align:left;gap:4px;padding:11px;border:1px solid #e2e8f0;background:#fff;border-radius:9px;color:#243449;cursor:pointer}.blog-link-result:hover{border-color:#15845a;background:#f3faf5}.blog-link-result small{color:#748197}.blog-link-foot{display:flex;justify-content:flex-end;margin-top:12px}.article-toc{padding:16px 20px;margin:20px 0;border:1px solid #dfe8dc;border-radius:10px;background:#f7faf4}.article-toc ol{margin:8px 0 0;padding-left:20px}.article-toc .toc-subitem{margin-left:16px;font-size:.95em}@media(max-width:600px){.blog-tool-group{width:100%}}";document.head.append(style);const p=document.createElement("section");p.id="blogCmsPanel";p.className="panel";p.innerHTML=`<div class="page-head"><div><h1 class="page-title">Blog & Artikel</h1><p class="page-subtitle">Buat, edit, jadwalkan, dan optimalkan artikel Bos Pangan.</p></div><div class="head-actions"><button class="btn" id="blogReload">Muat ulang</button><button class="btn primary" id="blogNew">+ Artikel baru</button></div></div><p class="status" id="blogCmsStatus">Memuat CMS Blog…</p><div id="blogEditor" class="hidden"><form id="blogForm"><div class="panel"><label>Judul<input name="title" maxlength="220" required style="display:block;width:100%;font-size:22px;margin:8px 0"></label><label>Slug URL<input name="slug" required maxlength="180" style="display:block;width:100%"></label><label>Ringkasan<textarea name="excerpt" rows="3" maxlength="500" style="display:block;width:100%"></textarea></label><div class="field-note" style="padding:8px 0"><b>Jenis konten:</b> Blog <span style="color:#6b7280">· ditetapkan otomatis oleh CMS</span><input type="hidden" name="category" value="blog"></div></div><div class="panel"><b>Konten artikel</b><div id="blogTools" class="blog-editor-toolbar" role="toolbar" aria-label="Peralatan editor artikel"><div class="blog-tool-group"><button type="button" class="btn" data-c="undo" title="Urungkan">↶</button><button type="button" class="btn" data-c="redo" title="Ulangi">↷</button><button type="button" class="btn" data-c="bold" title="Tebal"><b>B</b></button><button type="button" class="btn" data-c="italic" title="Miring"><i>I</i></button><button type="button" class="btn" data-c="underline" title="Garis bawah"><u>U</u></button><button type="button" class="btn" data-c="strikeThrough" title="Coret">S̶</button></div><div class="blog-tool-group"><button type="button" class="btn" data-c="p">Paragraf</button><button type="button" class="btn" data-c="h2">H2</button><button type="button" class="btn" data-c="h3">H3</button><button type="button" class="btn" data-c="h4">H4</button><button type="button" class="btn" data-c="quote">Kutipan</button></div><div class="blog-tool-group"><button type="button" class="btn" data-c="alignLeft">Rata kiri</button><button type="button" class="btn" data-c="alignCenter">Rata tengah</button><button type="button" class="btn" data-c="alignRight">Rata kanan</button><button type="button" class="btn" data-c="indent">Indent +</button><button type="button" class="btn" data-c="outdent">Indent −</button></div><div class="blog-tool-group"><button type="button" class="btn" data-c="ul">• Daftar</button><button type="button" class="btn" data-c="ol">1. Nomor</button><button type="button" class="btn" data-c="hr">Garis</button><button type="button" class="btn" data-c="toc">Daftar Isi</button></div><div class="blog-tool-group"><button type="button" class="btn" data-c="internal">Internal link</button><button type="button" class="btn" data-c="link">Tautan</button><button type="button" class="btn" data-c="image">Gambar</button><button type="button" class="btn" data-c="clear">Hapus format</button></div></div><div id="blogInternalLinkDialog" class="blog-link-dialog" hidden><div class="blog-link-backdrop" data-link-close></div><section class="blog-link-card" role="dialog" aria-modal="true" aria-labelledby="blogLinkTitle"><div class="blog-link-head"><h3 id="blogLinkTitle">Sisipkan tautan internal</h3><button type="button" class="btn" data-link-close>×</button></div><p>Pilih artikel Bos Pangan yang relevan. Teks yang Anda seleksi akan menjadi anchor text.</p><input id="blogLinkSearch" type="search" placeholder="Cari judul artikel atau topik…" autocomplete="off"><div id="blogLinkResults" class="blog-link-results">Memuat artikel…</div><div class="blog-link-foot"><button type="button" class="btn" data-link-close>Batal</button></div></section></div><div id="blogContent" contenteditable="true" style="min-height:400px;padding:18px;border:1px solid #dfe5ed;border-radius:8px;background:white;line-height:1.8"></div></div><div class="panel"><h3>Gambar Utama</h3><label>Upload JPG/PNG/WebP maks. 8 MB<input id="blogImage" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="blogPreview"></div><label>Alt text<input name="cover_image_alt" maxlength="180"></label><input type="hidden" name="cover_image_url"></div><div class="panel" id="blogSeoPluginHost"><div class="page-head"><div><h3 style="margin:0">Optimasi SEO</h3><p class="page-subtitle">Analisis konten, tampilan Google, schema, dan pratinjau sosial.</p></div><span class="btn" id="blogSeoScoreBadge">Belum dianalisis</span></div><label>SEO Title<input name="seo_title" maxlength="70" style="display:block;width:100%"></label><label>Meta Description<textarea name="seo_description" rows="3" maxlength="170" style="display:block;width:100%"></textarea></label><input type="hidden" name="focus_keyphrase" value=""><input type="hidden" name="seo_metadata" value="{}"><div id="blogSeoPluginExtra"></div></div><div class="head-actions"><button type="button" class="btn" id="blogBack">Kembali</button><button type="button" class="btn" id="blogSaveDraft">Simpan Draft</button><button type="submit" class="btn primary">Terbitkan</button></div></form></div><div id="blogList" class="table-wrap"></div>`;$("adminView").append(p);
$("blogNew").onclick=()=>reset();$("blogReload").onclick=load;$("blogBack").onclick=()=>toggle(false);$("blogForm").elements.title.oninput=()=>{if(!$("blogForm").elements.slug.dataset.manual)$("blogForm").elements.slug.value=slugify($("blogForm").elements.title.value)};$("blogForm").elements.slug.oninput=()=>{$("blogForm").elements.slug.dataset.manual="1";$("blogForm").elements.slug.value=slugify($("blogForm").elements.slug.value)};
const blogEditor=$("blogContent");
let blogSavedRange=null,blogLinkRows=[];
function blogSaveSelection(){
  const selection=window.getSelection();
  if(selection&&selection.rangeCount&&blogEditor.contains(selection.anchorNode))blogSavedRange=selection.getRangeAt(0).cloneRange();
  else blogSavedRange=null;
}
function blogRestoreSelection(){
  blogEditor.focus();
  if(!blogSavedRange)return;
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(blogSavedRange);
}
function blogSafeUrl(value){
  const url=String(value||"").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(url)||/^\/(?!\/)[^\s"'<>]*$/.test(url)||/^#[A-Za-z0-9_-]+$/.test(url);
}
function blogCloseLinkPicker(){$("blogInternalLinkDialog").hidden=true;blogSavedRange=null;}
function blogRenderLinkRows(query=""){
  const q=query.trim().toLocaleLowerCase("id-ID");
  const rows=blogLinkRows.filter(row=>(row.title+" "+(row.excerpt||"")+" "+(row.focus_keyphrase||"")).toLocaleLowerCase("id-ID").includes(q));
  $("blogLinkResults").innerHTML=rows.length?rows.map(row=>'<button type="button" class="blog-link-result" data-insert-blog-link="'+esc(row.slug)+'" data-link-label="'+esc(row.title)+'"><strong>'+esc(row.title)+'</strong><small>/blog/'+esc(row.slug)+'/</small></button>').join(""):'<p class="muted">Tidak ada artikel yang cocok.</p>';
}
async function blogOpenLinkPicker(){
  blogSaveSelection();$("blogInternalLinkDialog").hidden=false;$("blogLinkSearch").value="";$("blogLinkResults").textContent="Memuat artikel…";
  try{
    const{data,error}=await db.from("cms_articles").select("title,slug,excerpt,focus_keyphrase").eq("content_type","blog").eq("status","published").order("published_at",{ascending:false}).limit(100);
    if(error)throw error;
    const currentSlug=$("blogForm").elements.slug.value.trim();blogLinkRows=(data||[]).filter(row=>row.slug!==currentSlug);
    blogRenderLinkRows();$("blogLinkSearch").focus();
  }catch(error){$("blogLinkResults").textContent="Gagal memuat daftar artikel: "+error.message;}
}
function blogInsertInternalLink(slug,label){
  const href="/blog/"+slug+"/";blogRestoreSelection();
  const selection=window.getSelection(),selected=selection&&selection.toString().trim();
  if(selected&&blogEditor.contains(selection.anchorNode))document.execCommand("createLink",false,href);
  else document.execCommand("insertHTML",false,'<a href="'+esc(href)+'">'+esc(label)+'</a>');
  blogCloseLinkPicker();blogSaveSelection();window.dispatchEvent(new Event("blog:content-change"));
}
function blogEditorCommand(command){
  const map={ul:"insertUnorderedList",ol:"insertOrderedList",alignLeft:"justifyLeft",alignCenter:"justifyCenter",alignRight:"justifyRight",indent:"indent",outdent:"outdent",undo:"undo",redo:"redo",bold:"bold",italic:"italic",underline:"underline",strikeThrough:"strikeThrough",clear:"removeFormat",hr:"insertHorizontalRule"};
  if(command==="internal")return blogOpenLinkPicker();
  if(["h2","h3","h4","p","quote"].includes(command))document.execCommand("formatBlock",false,({quote:"blockquote"})[command]||command);
  else if(command==="link"){
    const selected=window.getSelection()?.toString().trim(),url=prompt("Masukkan URL HTTPS atau path internal (contoh /tentang-kami/):");
    if(!url)return;
    if(!blogSafeUrl(url)||url.startsWith("//"))return say("URL tidak valid. Gunakan HTTPS atau path internal.",true);
    if(selected)document.execCommand("createLink",false,url);
    else{const label=prompt("Teks tautan:")||url;document.execCommand("insertHTML",false,'<a href="'+esc(url)+'">'+esc(label)+'</a>');}
  }else if(command==="image"){
    const url=prompt("URL gambar HTTPS atau path gambar pada Bos Pangan:");
    if(!url)return;
    if(!blogSafeUrl(url)||url.startsWith("#"))return say("URL gambar tidak valid.",true);
    const alt=prompt("Alt text gambar (jelaskan isi gambar):")||"";
    document.execCommand("insertHTML",false,'<figure><img src="'+esc(url)+'" alt="'+esc(alt)+'" loading="lazy" style="max-width:100%;height:auto"><figcaption>'+esc(alt)+'</figcaption></figure>');
  }else if(command==="toc"){
    const headings=Array.from(blogEditor.querySelectorAll("h2,h3")).map((h,index)=>{
      const label=h.innerText.trim();if(!label)return null;
      if(!h.id)h.id="bagian-"+(index+1)+"-"+slugify(label);
      return{tag:h.tagName.toLowerCase(),id:h.id,label};
    }).filter(Boolean);
    if(!headings.length)return say("Tambahkan H2 atau H3 terlebih dahulu untuk membuat daftar isi.",true);
    const items=headings.map(h=>'<li class="'+(h.tag==="h3"?"toc-subitem":"")+'"><a href="#'+esc(h.id)+'">'+esc(h.label)+'</a></li>').join("");
    document.execCommand("insertHTML",false,'<nav class="article-toc" aria-label="Daftar isi"><strong>Daftar Isi</strong><ol>'+items+'</ol></nav><p></p>');
  }else if(map[command])document.execCommand(map[command],false,null);
  blogSaveSelection();window.dispatchEvent(new Event("blog:content-change"));
}
$("blogTools").onmousedown=e=>{if(e.target.closest("button")){if(e.target.closest("[data-c='internal']"))blogSaveSelection();else e.preventDefault();}};
$("blogTools").onclick=e=>{const command=e.target.closest("[data-c]")?.dataset.c;if(command)blogEditorCommand(command);};
$("blogInternalLinkDialog").onclick=e=>{
  if(e.target.closest("[data-link-close]")){blogCloseLinkPicker();return;}
  const link=e.target.closest("[data-insert-blog-link]");if(link)blogInsertInternalLink(link.dataset.insertBlogLink,link.dataset.linkLabel);
};
$("blogLinkSearch").oninput=e=>blogRenderLinkRows(e.target.value);
blogEditor.addEventListener("keyup",blogSaveSelection);blogEditor.addEventListener("mouseup",blogSaveSelection);
blogEditor.addEventListener("input",()=>window.dispatchEvent(new Event("blog:content-change")));
$("blogImage").onchange=()=>{const f=$("blogImage").files[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>8*1024*1024){$("blogImage").value="";say("Format gambar tidak valid atau lebih dari 8 MB.",true);return}$("blogPreview").innerHTML='<img alt="Preview" src="'+URL.createObjectURL(f)+'" style="max-width:260px;max-height:180px;margin-top:10px">'};$("blogSaveDraft").onclick=()=>save("draft");$("blogForm").onsubmit=e=>{e.preventDefault();save("published")};$("blogList").onclick=e=>{const a=e.target.closest("[data-edit]"),d=e.target.closest("[data-del]");if(a)editRow(a.dataset.edit);if(d)delRow(d.dataset.del)}}
function toggle(v){$("blogEditor").classList.toggle("hidden",!v);$("blogList").classList.toggle("hidden",v)}function reset(){edit=null;$("blogForm").reset();$("blogForm").elements.category.value="blog";$("blogContent").innerHTML="";$("blogPreview").innerHTML="";$("blogForm").elements.focus_keyphrase.value="";$("blogForm").elements.seo_metadata.value="{}";window.dispatchEvent(new Event("blog:seo-reset"));delete $("blogForm").elements.slug.dataset.manual;$("blogImage").value="";toggle(true)}
async function upload(){const f=$("blogImage").files[0];if(!f)return $("blogForm").elements.cover_image_url.value||null;const ext=f.type==="image/jpeg"?"jpg":f.type.split("/")[1],path=user.id+"/"+crypto.randomUUID()+"."+ext,{error}=await db.storage.from("blog-images").upload(path,f,{contentType:f.type});if(error)throw error;return db.storage.from("blog-images").getPublicUrl(path).data.publicUrl}
async function save(status){const f=$("blogForm"),title=f.elements.title.value.trim(),slug=slugify(f.elements.slug.value),html=$("blogContent").innerHTML.trim();if(!title||!slug||!html)return say("Judul, slug, dan konten wajib diisi.",true);const b=status==="draft"?$("blogSaveDraft"):f.querySelector('[type="submit"]');b.disabled=true;try{say("Menyimpan…");const img=await upload(),now=new Date().toISOString(),payload={content_type:"blog",title,slug,excerpt:f.elements.excerpt.value.trim(),content_html:html,category:"blog",cover_image_url:img,cover_image_alt:f.elements.cover_image_alt.value.trim(),seo_title:f.elements.seo_title.value.trim()||title,seo_description:f.elements.seo_description.value.trim()||f.elements.excerpt.value.trim(),focus_keyphrase:f.elements.focus_keyphrase.value.trim(),seo_metadata:JSON.parse(f.elements.seo_metadata.value||"{}"),status,updated_by:user.id,updated_at:now,published_at:status==="published"?now:null};if(edit)payload.id=edit;else{payload.created_by=user.id;payload.author_id=user.id}const{data,error}=await db.from("cms_articles").upsert(payload,{onConflict:"id"}).select("id").single();if(error)throw error;edit=data.id;f.elements.cover_image_url.value=img||"";$("blogImage").value="";let publishNotice="Draft tersimpan.";
if(status==="published"){
  publishNotice="Artikel tersimpan di CMS, tetapi pemicu build belum berhasil.";
  try{
    const{data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw new Error("Sesi admin tidak ditemukan.");
    const response=await fetch("/api/blog-deploy",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({slug})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||("HTTP "+response.status));
    publishNotice="Artikel diterbitkan. Cloudflare sedang membuat halaman statis /blog/"+slug+"/.";
  }catch(buildError){
    publishNotice="Artikel sudah tersimpan di CMS, tetapi halaman statis belum diperbarui otomatis: "+buildError.message;
  }
}
await load();toggle(false);say(publishNotice)}catch(e){say("Gagal: "+e.message,true)}finally{b.disabled=false}}
async function load(){const{data,error}=await db.from("cms_articles").select("id,title,slug,category,status,updated_at").eq("content_type","blog").order("updated_at",{ascending:false});if(error)throw error;$("blogList").innerHTML=data.length?'<table><thead><tr><th>Judul</th><th>Kategori</th><th>Status</th><th>Diubah</th><th>Aksi</th></tr></thead><tbody>'+data.map(r=>'<tr><td><b>'+esc(r.title)+'</b><br><small>/blog/'+esc(r.slug)+'/</small></td><td>'+esc(r.category)+'</td><td>'+esc(r.status)+'</td><td>'+new Date(r.updated_at).toLocaleString("id-ID")+'</td><td><button class="btn" data-edit="'+r.id+'">Edit</button> <button class="btn" data-del="'+r.id+'">Hapus</button> '+(r.status==="published"?'<a class="btn" href="/blog/'+encodeURIComponent(r.slug)+'/" target="_blank">Lihat</a>':"")+'</td></tr>').join("")+'</tbody></table>':'<p>Belum ada artikel Blog.</p>';say(data.length+" artikel.")}

function markdownToEditorHtml(markdown){
  const escHtml=value=>String(value??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const safeLink=value=>/^(https?:\/\/|\/(?!\/)|#)/i.test(String(value||""))?String(value):"#";
  const inline=value=>{
    let s=String(value||"");
    const slots=[];
    const hold=html=>{const key="\u0000"+slots.length+"\u0000";slots.push(html);return key;};
    s=s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(_,alt,url)=>hold('<img src="'+escHtml(safeLink(url))+'" alt="'+escHtml(alt)+'">'));
    s=s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,label,url)=>hold('<a href="'+escHtml(safeLink(url))+'">'+escHtml(label)+'</a>'));
    s=escHtml(s).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>");
    return s.replace(/\u0000(\d+)\u0000/g,(_,n)=>slots[Number(n)]||"");
  };
  const lines=String(markdown||"").replace(/\r/g,"").split("\n"),out=[];
  let paragraph=[],i=0;
  const flush=()=>{if(paragraph.length){out.push("<p>"+inline(paragraph.join(" "))+"</p>");paragraph=[];}};
  while(i<lines.length){
    const line=lines[i].trim();
    if(!line){flush();i++;continue;}
    const heading=line.match(/^(#{1,3})\s+(.+)$/);
    if(heading){flush();const n=heading[1].length;out.push("<h"+n+">"+inline(heading[2])+"</h"+n+">");i++;continue;}
    if(/^[-*]\s+/.test(line)){flush();const items=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i].trim())){items.push("<li>"+inline(lines[i].trim().replace(/^[-*]\s+/,""))+"</li>");i++;}out.push("<ul>"+items.join("")+"</ul>");continue;}
    if(/^\d+\.\s+/.test(line)){flush();const items=[];while(i<lines.length&&/^\d+\.\s+/.test(lines[i].trim())){items.push("<li>"+inline(lines[i].trim().replace(/^\d+\.\s+/,""))+"</li>");i++;}out.push("<ol>"+items.join("")+"</ol>");continue;}
    paragraph.push(line);i++;
  }
  flush();return out.join("");
}

async function editRow(id){const{data,error}=await db.from("cms_articles").select("*").eq("id",id).eq("content_type","blog").single();if(error)return say(error.message,true);edit=id;const f=$("blogForm");["title","slug","excerpt","category","cover_image_url","cover_image_alt","seo_title","seo_description"].forEach(k=>f.elements[k].value=data[k]||"");f.elements.slug.dataset.manual="1";f.elements.focus_keyphrase.value=data.focus_keyphrase||"";f.elements.seo_metadata.value=JSON.stringify(data.seo_metadata||{});$("blogContent").innerHTML=data.content_html||markdownToEditorHtml(data.content_markdown||"");window.dispatchEvent(new CustomEvent("blog:seo-load",{detail:{focusKeyphrase:data.focus_keyphrase||"",metadata:data.seo_metadata||{}}}));$("blogPreview").innerHTML=data.cover_image_url?'<img src="'+esc(data.cover_image_url)+'" style="max-width:260px">':"";toggle(true);say("Edit: "+data.title)}
async function delRow(id){if(!confirm("Hapus artikel ini?"))return;const{error}=await db.from("cms_articles").delete().eq("id",id).eq("content_type","blog");if(error)return say(error.message,true);await load();say("Artikel dihapus.")}
async function init(){mount();const{data:{session},error}=await db.auth.getSession();if(error||!session)throw error||new Error("Sesi CMS berakhir");user=session.user;const{data:p,error:e}=await db.from("profiles").select("role").eq("id",user.id).single();if(e||!["admin","super_admin"].includes(p?.role))throw e||new Error("Tidak memiliki hak akses CMS");ready=true;await load()}
window.addEventListener("cms:blog-open",()=>{if(!ready)init().catch(e=>say("CMS Blog gagal dibuka: "+e.message,true));else load().catch(e=>say(e.message,true))});