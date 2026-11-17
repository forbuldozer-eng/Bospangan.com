import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
let initialized=false, products=[], orders=[];
const today=()=>new Date().toISOString().slice(0,10);
function mount(){
 if($("productReportPanel"))return;
 const root=$("adminView");if(!root)return;
 const panel=document.createElement("section");panel.id="productReportPanel";panel.className="panel";
 panel.innerHTML=`
 <div class="page-head"><div><h1 class="page-title">Laporan Produk</h1><p class="page-subtitle">Ringkasan katalog, stok, dan performa penjualan produk.</p></div><div class="head-actions"><button class="btn" id="productReportRefresh" type="button">Muat ulang</button><button class="btn" id="productReportExport" type="button">Export CSV</button></div></div>
 <p class="status" id="productReportStatus" role="status" aria-live="polite">Menyiapkan laporan...</p>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px"><label>Dari tanggal <input id="productReportStart" type="date"></label><label>Sampai tanggal <input id="productReportEnd" type="date"></label><button class="btn primary" id="productReportApply" type="button">Terapkan</button></div>
 <div class="stats">
  <div class="stat-card"><div class="stat-top">Total produk</div><strong id="productReportCount">—</strong></div>
  <div class="stat-card"><div class="stat-top">Produk tayang</div><strong id="productReportPublished">—</strong></div>
  <div class="stat-card"><div class="stat-top">Unit terjual (periode)</div><strong id="productReportUnits">—</strong></div>
  <div class="stat-card"><div class="stat-top">Nilai stok pada harga jual</div><strong id="productReportStockValue">—</strong></div>
 </div>
 <div class="panel"><h2>Performa produk</h2><p class="page-subtitle">Penjualan dihitung dari pesanan berstatus pembayaran lunas dan tidak dibatalkan.</p><div id="productReportTable" class="table-wrap"></div></div>
 <div class="panel"><h2>Ringkasan stok</h2><div id="productReportStockTable" class="table-wrap"></div><p class="page-subtitle">Nilai stok adalah estimasi stok saat ini × harga jual, bukan HPP atau nilai persediaan akuntansi.</p></div>`;
 root.append(panel);
 $("productReportStart").value=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
 $("productReportEnd").value=today();
 $("productReportRefresh").onclick=load;
 $("productReportApply").onclick=load;
 $("productReportExport").onclick=exportCsv;
}
async function fetchAll(factory){
 const all=[];for(let offset=0;;offset+=500){const {data,error}=await factory().range(offset,offset+499);if(error)throw error;all.push(...(data||[]));if(!data||data.length<500)break;}return all;
}
function aggregate(){
 const start=$("productReportStart").value,end=$("productReportEnd").value;
 const sales=new Map();
 orders.filter(o=>o.status!=="cancelled"&&o.payment_status==="paid"&&o.created_at.slice(0,10)>=start&&o.created_at.slice(0,10)<=end)
 .forEach(o=>(o.order_items||[]).forEach(i=>{const key=i.sku_snapshot||i.product_name_snapshot||"unknown";const x=sales.get(key)||{qty:0,revenue:0,name:i.product_name_snapshot||"Produk dihapus"};x.qty+=Number(i.quantity||0);x.revenue+=Number(i.line_subtotal||0)+Number(i.tax_amount||0);sales.set(key,x);}));
 return products.map(p=>{const s=sales.get(p.sku)||{qty:0,revenue:0};return {...p,sold:s.qty,revenue:s.revenue};}).sort((a,b)=>b.sold-a.sold||a.name.localeCompare(b.name,"id"));
}
function render(){
 const rows=aggregate(),stockValue=products.reduce((n,p)=>n+Number(p.stock||0)*Number(p.price||0),0);
 $("productReportCount").textContent=products.length.toLocaleString("id-ID");
 $("productReportPublished").textContent=products.filter(p=>p.is_published).length.toLocaleString("id-ID");
 $("productReportUnits").textContent=rows.reduce((n,p)=>n+p.sold,0).toLocaleString("id-ID");
 $("productReportStockValue").textContent=money(stockValue);
 $("productReportTable").innerHTML=rows.length?'<table><thead><tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Unit terjual</th><th>Nilai penjualan</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku)+'</td><td>'+esc(p.category)+'</td><td>'+p.sold.toLocaleString("id-ID")+'</td><td>'+money(p.revenue)+'</td></tr>').join("")+'</tbody></table>':'<p class="muted">Belum ada produk.</p>';
 const stock=[...products].sort((a,b)=>Number(a.stock)-Number(b.stock));
 $("productReportStockTable").innerHTML=stock.length?'<table><thead><tr><th>Produk</th><th>SKU</th><th>Stok</th><th>Harga jual</th><th>Status stok</th></tr></thead><tbody>'+stock.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku)+'</td><td>'+Number(p.stock||0).toLocaleString("id-ID")+' '+esc(p.unit||"")+'</td><td>'+money(p.price)+'</td><td>'+(Number(p.stock)<=0?"Habis":Number(p.stock)<=5?"Menipis":"Tersedia")+'</td></tr>').join("")+'</tbody></table>':'<p class="muted">Belum ada data stok.</p>';
}
async function load(){
 const status=$("productReportStatus");if(!status)return;
 const button=$("productReportRefresh");button.disabled=true;status.textContent="Mengambil data katalog dan transaksi...";
 try{
  const start=$("productReportStart").value,end=$("productReportEnd").value;if(!start||!end||start>end)throw new Error("Rentang tanggal tidak valid.");
  [products,orders]=await Promise.all([
   fetchAll(()=>db.from("products").select("id,name,sku,category,price,stock,unit,is_published,created_at").order("name").order("sku")),
   fetchAll(()=>db.from("orders").select("created_at,status,payment_status,order_items(sku_snapshot,product_name_snapshot,quantity,line_subtotal,tax_amount)").gte("created_at",new Date(start+"T00:00:00").toISOString()).lte("created_at",new Date(end+"T23:59:59.999").toISOString()).order("created_at",{ascending:false}))
  ]);
  render();status.textContent="Laporan berhasil diperbarui. "+products.length+" produk dan "+orders.length+" transaksi diperiksa.";
 }catch(e){status.textContent="Gagal memuat laporan: "+(e.message||e);}
 finally{button.disabled=false;}
}
function exportCsv(){
 const rows=aggregate(),headers=["Nama Produk","SKU","Kategori","Stok Saat Ini","Harga Jual","Unit Terjual","Nilai Penjualan"],csv=[headers,...rows.map(p=>[p.name,p.sku,p.category,p.stock,p.price,p.sold,p.revenue])].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="laporan-produk-bos-pangan.csv";a.click();URL.revokeObjectURL(url);
}
window.addEventListener("cms:product-report-open",()=>{mount();if(!initialized){initialized=true;load();}else load();});
