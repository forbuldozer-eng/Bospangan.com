import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const parts=location.pathname.split("/").filter(Boolean);
const slug=parts[1]||"";
const qs=new URLSearchParams(location.search);
const foodSlug=parts[1]==="pangan"?(parts[2]||qs.get("slug")||""):"";
const show=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html};
async function categories(){const {data,error}=await db.from("nutrition_categories").select("id,slug,name,description,sort_order").eq("is_active",true).order("sort_order");if(error)throw error;return data||[]}
async function foods(categoryId){let q=db.from("nutrition_foods").select("id,slug,name,scientific_name,description,food_state,serving_basis,category_id").eq("is_published",true).order("name");if(categoryId)q=q.eq("category_id",categoryId);const {data,error}=await q;if(error)throw error;return data||[]}
const card=f=>`<article class="card"><span class="type">Bahan pangan</span><h3>${esc(f.name)}</h3><p>${esc(f.description||"Informasi bahan pangan dan komposisi gizi terverifikasi.")}</p><a href="/nutrisi/pangan/${encodeURIComponent(f.slug)}/">Lihat informasi gizi →</a></article>`;
async function directory(){
 const cats=await categories(),rows=await foods(null);
 const sel=document.getElementById("nutritionCategoryFilter"),input=document.getElementById("nutritionSearch");
 if(sel)sel.innerHTML='<option value="">Semua kategori</option>'+cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
 const term=(input?.value||"").toLocaleLowerCase("id-ID"),paint=()=>{
 const t=(input?.value||"").toLocaleLowerCase("id-ID"),cat=sel?.value||"";
 const found=rows.filter(f=>(!cat||f.category_id===cat)&&(`${f.name} ${f.scientific_name} ${f.description}`).toLocaleLowerCase("id-ID").includes(t));
 show("nutritionCount",found.length+" bahan pangan");
 show("nutritionFoods",found.length?found.map(card).join(""):'<p class="muted">Belum ada data terbit untuk pencarian ini.</p>');
 };
 input?.addEventListener("input",paint);sel?.addEventListener("change",paint);paint();
}
async function category(){
 const {data:c,error}=await db.from("nutrition_categories").select("id,slug,name,description").eq("slug",slug).eq("is_active",true).maybeSingle();
 if(error)throw error;if(!c){show("nutritionFoods","<p>Kategori tidak ditemukan.</p>");return}
 const title=document.getElementById("nutritionTitle"),desc=document.getElementById("nutritionDescription");if(title)title.textContent=c.name;if(desc)desc.textContent=c.description;
 const rows=await foods(c.id);show("nutritionFoods",rows.length?rows.map(card).join(""):'<p>Belum ada bahan pangan terverifikasi yang diterbitkan pada kategori ini.</p>');
}
async function food(){
 const {data:f,error}=await db.from("nutrition_foods").select("id,slug,name,scientific_name,description,food_state,edible_portion_percent,serving_basis,source_name,source_url,source_version,source_license,data_notes,nutrition_categories(name,slug)").eq("slug",foodSlug).eq("is_published",true).maybeSingle();
 if(error)throw error;if(!f){show("nutritionFoodDetail","<h1>Data pangan belum tersedia</h1><p>Data belum diterbitkan atau alamat tidak ditemukan.</p>");return}
 const {data:vals,error:ve}=await db.from("nutrition_food_nutrients").select("amount,basis,source_note,nutrition_nutrients(name,unit,sort_order)").eq("food_id",f.id);
 if(ve)throw ve;const num=v=>v==null?"—":Number(v).toLocaleString("id-ID",{maximumFractionDigits:5});
 document.title=f.name+" — Informasi Gizi | Bos Pangan";
 show("nutritionFoodDetail",`<p class="crumb"><a href="/nutrisi/">Nutrisi</a> / <a href="/nutrisi/${esc(f.nutrition_categories?.slug||"")}">${esc(f.nutrition_categories?.name||"Kategori")}</a></p><h1>${esc(f.name)}</h1><p class="lead">${esc(f.description)}</p>${f.scientific_name?`<p><i>Nama ilmiah: ${esc(f.scientific_name)}</i></p>`:""}<section class="panel"><h2>Informasi bahan</h2><p>Kondisi: ${esc(f.food_state)}</p><p>Basis: ${esc(f.serving_basis)}</p>${f.edible_portion_percent!=null?`<p>Bagian dapat dimakan: ${num(f.edible_portion_percent)}%</p>`:""}</section><h2>Komposisi zat gizi</h2>${vals?.length?`<div style="overflow:auto"><table><thead><tr><th>Komponen</th><th>Jumlah</th><th>Satuan</th></tr></thead><tbody>${vals.sort((a,b)=>(a.nutrition_nutrients?.sort_order||999)-(b.nutrition_nutrients?.sort_order||999)).map(v=>`<tr><td>${esc(v.nutrition_nutrients?.name)}</td><td>${num(v.amount)}</td><td>${esc(v.nutrition_nutrients?.unit)}</td></tr>`).join("")}</tbody></table></div>`:"<p>Belum ada nilai komposisi gizi terverifikasi yang dipublikasikan.</p>"}<section class="panel"><h2>Sumber dan catatan</h2><p>Sumber: ${esc(f.source_name||"Belum dicantumkan")}</p>${f.source_version?`<p>Versi: ${esc(f.source_version)}</p>`:""}${f.source_license?`<p>Lisensi: ${esc(f.source_license)}</p>`:""}${f.source_url?`<p><a href="${esc(f.source_url)}" rel="nofollow noopener" target="_blank">Lihat sumber data</a></p>`:""}<p>${esc(f.data_notes)}</p></section>`);
}
(async()=>{const target=document.getElementById("nutritionFoods")||document.getElementById("nutritionFoodDetail");if(!target)return;try{if(document.getElementById("nutritionFoodDetail"))await food();else if(slug)await category();else await directory()}catch(e){console.error(e);target.innerHTML='<p>Data belum dapat dimuat. Pastikan migrasi database sudah dijalankan pada Supabase.</p>'}})();