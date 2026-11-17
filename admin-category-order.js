import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY),root=document.getElementById("adminView"),TABLE="homepage_category_order";
let rows=[],busy=false;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(message,error=false){const n=document.getElementById("categoryOrderStatus");if(!n)return;n.textContent=message;n.style.color=error?"#b42318":"#176b45";n.style.background=error?"#fff1f0":"#edf8f1";}
function render(){
 const list=document.getElementById("categoryOrderList");if(!list)return;
 if(!rows.length){list.innerHTML='<p class="muted">Belum ada kategori aktif. Tambahkan kategori melalui menu Kategori Produk.</p>';return;}
 list.innerHTML=rows.map((r,i)=>'<div style="display:grid;grid-template-columns:42px minmax(130px,1fr) auto auto;align-items:center;gap:12px;padding:13px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin:8px 0"><span style="font-weight:800;color:#64748b;text-align:center">'+(i+1)+'</span><strong>'+esc((r.icon?r.icon+" ":"")+r.name)+'</strong><label style="display:flex;align-items:center;gap:7px;font-size:13px;color:#475569"><input type="checkbox" data-visible="'+i+'" '+(r.is_visible?"checked":"")+' style="width:auto"> Tampilkan</label><span style="display:flex;gap:5px"><button type="button" data-up="'+i+'" '+(i===0?"disabled":"")+' aria-label="Naikkan kategori">↑</button><button type="button" data-down="'+i+'" '+(i===rows.length-1?"disabled":"")+' aria-label="Turunkan kategori">↓</button></span></div>').join("");
 list.querySelectorAll("[data-up]").forEach(b=>b.addEventListener("click",()=>move(Number(b.dataset.up),-1)));
 list.querySelectorAll("[data-down]").forEach(b=>b.addEventListener("click",()=>move(Number(b.dataset.down),1)));
 list.querySelectorAll("[data-visible]").forEach(i=>i.addEventListener("change",()=>{rows[Number(i.dataset.visible)].is_visible=i.checked;}));
}
function move(i,offset){const n=i+offset;if(n<0||n>=rows.length)return;[rows[i],rows[n]]=[rows[n],rows[i]];render();}
async function load(){
 status("Memuat kategori aktif dari CMS…");
 const [cats,orders]=await Promise.all([
  db.from("product_categories").select("slug,name,icon,sort_order").eq("is_active",true).order("sort_order",{ascending:true}).order("name",{ascending:true}),
  db.from(TABLE).select("slug,name,sort_order,is_visible").order("sort_order",{ascending:true})
 ]);
 if(cats.error){rows=[];render();status("Gagal memuat master kategori: "+cats.error.message,true);return;}
 if(orders.error){rows=[];render();status("Tabel urutan kategori belum tersedia. Jalankan supabase/homepage-category-order.sql di Supabase SQL Editor.",true);return;}
 const saved=new Map((orders.data||[]).map(x=>[x.slug,x]));
 rows=(cats.data||[]).map(c=>{const o=saved.get(c.slug);return {slug:c.slug,name:c.name,icon:c.icon||"",sort_order:Number(o?.sort_order??c.sort_order??0),is_visible:o?Boolean(o.is_visible):true};})
  .sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name,"id"));
 render();status(rows.length+" kategori aktif dimuat dari CMS. Kategori baru otomatis masuk ke daftar ini.");
}
async function save(){
 if(busy||!rows.length)return;busy=true;const btn=document.getElementById("saveCategoryOrder");btn.disabled=true;status("Menyimpan perubahan kategori…");
 const payload=rows.map((r,i)=>({slug:r.slug,name:r.name,sort_order:i+1,is_visible:Boolean(r.is_visible),updated_at:new Date().toISOString()}));
 const {error}=await db.from(TABLE).upsert(payload,{onConflict:"slug"});busy=false;btn.disabled=false;
 if(error){status("Gagal menyimpan: "+error.message,true);return;}rows=payload;render();status("Berhasil disimpan. Urutan dan visibilitas homepage sudah diperbarui.");
}
function mount(){
 if(!root||document.getElementById("categoryOrderPanel"))return;
 const panel=document.createElement("section");panel.id="categoryOrderPanel";panel.className="panel hidden";
 panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap"><div><h2>Urutan Kategori</h2><p class="muted">Atur posisi dan visibilitas seluruh kategori aktif dari CMS pada halaman utama Bos Pangan.</p></div><button class="btn" type="button" id="reloadCategoryOrder">Muat Ulang</button></div><div id="categoryOrderStatus" role="status" style="padding:12px 14px;border-radius:10px;background:#edf8f1;margin:14px 0">Menyiapkan modul…</div><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><strong>Daftar kategori halaman utama</strong><small class="muted">Gunakan ↑ dan ↓ untuk mengubah urutan.</small></div><div id="categoryOrderList" style="margin:12px 0"></div><div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="saveCategoryOrder">Simpan Urutan</button></div>';
 root.appendChild(panel);document.getElementById("reloadCategoryOrder").addEventListener("click",load);document.getElementById("saveCategoryOrder").addEventListener("click",save);
}
mount();
window.addEventListener("cms:category-order-open",()=>{mount();document.getElementById("categoryOrderPanel")?.classList.remove("hidden");load();});
