import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:2}).format(Number(value||0));
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const previewMode=location.hostname!=="bospangan.com"&&location.hostname!=="www.bospangan.com";
let initialized=false,products=[],suppliers=[];
const status=message=>{const node=$("inventoryStatus");if(node)node.textContent=message;};
const dateInput=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};

function panelMarkup(){
 const section=document.createElement("section");
 section.id="inventoryHppPanel";section.className="panel";
 section.innerHTML=`
  <div class="page-head"><div><h1 class="page-title">Persediaan & HPP</h1><p class="page-subtitle">Supplier, pembelian barang, kartu stok, dan harga pokok rata-rata bergerak.</p></div></div>
  <div id="inventoryStatus" class="status" role="status" aria-live="polite">Memuat modul persediaan...</div>
  <div class="tabs inventory-tabs">
   <button type="button" data-inv-tab="stock" class="active">Stok & HPP</button>
   <button type="button" data-inv-tab="suppliers">Supplier</button>
   <button type="button" data-inv-tab="purchases">Pembelian</button>
   <button type="button" data-inv-tab="ledger">Kartu Stok</button>
  </div>
  <div id="inv-stock">
   <div class="stats inventory-stats">
    <article class="stat-card"><div class="stat-top"><span>Jenis Produk</span><span class="stat-symbol">▥</span></div><strong id="invProductCount">0</strong><small>Produk terdaftar</small></article>
    <article class="stat-card"><div class="stat-top"><span>Total Unit Stok</span><span class="stat-symbol">▤</span></div><strong id="invStockQty">0</strong><small>Akumulasi kuantitas semua produk</small></article>
    <article class="stat-card"><div class="stat-top"><span>Nilai Persediaan</span><span class="stat-symbol">Rp</span></div><strong id="invStockValue">Rp0</strong><small>Stok × HPP rata-rata</small></article>
   </div>
   <div class="panel"><div class="row" style="align-items:center;justify-content:space-between"><div><h2 style="margin:0">Daftar stok dan HPP</h2><p class="page-subtitle">Harga modal diperbarui otomatis saat pembelian diterima.</p></div><button type="button" id="invRefreshStock">Muat ulang</button></div><div id="invStockTable" class="table-wrap"></div></div>
  </div>
  <div id="inv-suppliers" class="hidden">
   <div class="panel"><h2>Tambah supplier</h2>
    <form id="supplierForm" class="inventory-form">
     <div class="row"><label>Kode supplier<input name="supplier_code" maxlength="40" required placeholder="SUP-001"></label><label>Nama supplier<input name="name" maxlength="160" required></label></div>
     <div class="row"><label>Nama kontak<input name="contact_name" maxlength="120"></label><label>Telepon<input name="phone" maxlength="40"></label><label>Email<input name="email" type="email" maxlength="254"></label></div>
     <label>Alamat<textarea name="address" rows="2" maxlength="1000"></textarea></label>
     <label>Catatan<textarea name="notes" rows="2" maxlength="1000"></textarea></label>
     <button class="primary" type="submit">Simpan supplier</button>
    </form>
   </div>
   <div class="panel"><h2>Daftar supplier</h2><div id="invSupplierTable" class="table-wrap"></div></div>
  </div>
  <div id="inv-purchases" class="hidden">
   <div class="panel"><h2>Buat pembelian barang</h2><p class="page-subtitle">Simpan sebagai draft, lalu terima barang untuk menambah stok dan menghitung HPP moving average.</p>
    <form id="purchaseForm" class="inventory-form">
     <div class="row"><label>Supplier<select name="supplier_id" id="invPurchaseSupplier" required></select></label><label>Tanggal pembelian<input name="purchase_date" type="date" required></label><label>Jatuh tempo<input name="due_date" type="date"></label></div>
     <div class="row" style="align-items:center;justify-content:space-between"><h3>Item pembelian</h3><button type="button" id="invAddLine">+ Tambah item</button></div>
     <div id="invPurchaseLines"></div>
     <div class="row"><label>Biaya tambahan (angkut, bongkar, dll.)<input name="additional_cost" type="number" min="0" step="0.01" value="0"></label><label>Catatan<textarea name="notes" rows="2"></textarea></label></div>
     <button class="primary" type="submit">Simpan draft pembelian</button>
    </form>
   </div>
   <div class="panel"><h2>Riwayat pembelian & hutang supplier</h2><div id="invPurchaseTable" class="table-wrap"></div></div>
  </div>
  <div id="inv-ledger" class="hidden">
   <div class="panel"><h2>Kartu stok</h2><p class="page-subtitle">Riwayat penerimaan, pembukaan saldo, dan penyesuaian persediaan.</p><div id="invMovementTable" class="table-wrap"></div></div>
   <div class="panel"><h2>Riwayat perubahan HPP</h2><div id="invCostHistory" class="table-wrap"></div></div>
  </div>`;
 $("adminView").append(section);
 section.querySelectorAll("[data-inv-tab]").forEach(button=>button.addEventListener("click",()=>{
  section.querySelectorAll("[data-inv-tab]").forEach(b=>b.classList.toggle("active",b===button));
  ["stock","suppliers","purchases","ledger"].forEach(tab=>$("inv-"+tab).classList.toggle("hidden",tab!==button.dataset.invTab));
 }));
 return section;
}
function productOptions(){return products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.sku)+'</option>').join("");}
function addPurchaseLine(){
 const root=$("invPurchaseLines"),row=document.createElement("div");
 row.className="inventory-line";
 row.innerHTML='<label>Produk<select class="inv-line-product" required>'+productOptions()+'</select></label><label>Jumlah<input class="inv-line-qty" type="number" min="0.001" step="0.001" value="1" required></label><label>Harga beli / unit (Rp)<input class="inv-line-cost" type="number" min="0" step="0.01" required></label><button type="button" class="inv-remove-line" aria-label="Hapus item">Hapus</button>';
 row.querySelector(".inv-remove-line").addEventListener("click",()=>{if(root.children.length>1)row.remove();else status("Minimal satu item pembelian harus ada.");});
 root.append(row);
}
async function loadProducts(){
 const {data,error}=await db.from("products").select("id,sku,name,unit,price,stock,cost_price,cost_initialized,is_published").order("name");
 if(error)throw error;products=data||[];
 const qty=products.reduce((sum,p)=>sum+Number(p.stock||0),0),value=products.reduce((sum,p)=>sum+Number(p.stock||0)*Number(p.cost_price||0),0);
 $("invProductCount").textContent=products.length.toLocaleString("id-ID");
 $("invStockQty").textContent=qty.toLocaleString("id-ID");
 $("invStockValue").textContent=money(value);
 $("invStockTable").innerHTML=products.length?'<table><thead><tr><th>Produk</th><th>SKU</th><th>Stok</th><th>Harga jual</th><th>HPP rata-rata</th><th>Nilai stok</th><th>Aksi</th></tr></thead><tbody>'+products.map(p=>{
  const valuationMissing=Number(p.stock)>0&&!p.cost_initialized;
  return '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku)+'</td><td>'+Number(p.stock||0).toLocaleString("id-ID")+' '+esc(p.unit)+'</td><td>'+money(p.price)+'</td><td>'+(valuationMissing?'<span class="inventory-warning">Belum dinilai</span>':money(p.cost_price))+'</td><td>'+money(Number(p.stock||0)*Number(p.cost_price||0))+'</td><td>'+(valuationMissing?'<button type="button" data-opening-cost="'+esc(p.id)+'">Tetapkan HPP awal</button> ':'')+'<button type="button" data-adjust-stock="'+esc(p.id)+'">Koreksi stok</button></td></tr>';
 }).join("")+'</tbody></table>':'<div class="inventory-empty">Belum ada produk.</div>';
 $("invStockTable").querySelectorAll("[data-opening-cost]").forEach(button=>button.addEventListener("click",async()=>{
  const p=products.find(x=>x.id===button.dataset.openingCost),cost=prompt("Masukkan HPP awal per "+p.unit+" untuk stok "+p.stock+". Gunakan bukti pembelian atau data modal yang sudah diverifikasi.");
  if(cost===null)return;const amount=Number(cost);if(!Number.isFinite(amount)||amount<0){status("Harga modal tidak valid.");return;}
  const notes=prompt("Catatan sumber harga modal (wajib), misalnya invoice pembelian awal:");
  if(!notes)return;button.disabled=true;
  const {error}=await db.rpc("set_product_opening_cost",{p_product_id:p.id,p_unit_cost:amount,p_notes:notes.trim()});
  if(error)status("Gagal menetapkan HPP awal: "+error.message);else{status("HPP awal tersimpan.");await refreshAll();}
 }));
 $("invStockTable").querySelectorAll("[data-adjust-stock]").forEach(button=>button.addEventListener("click",async()=>{
  const p=products.find(x=>x.id===button.dataset.adjustStock),delta=prompt("Masukkan perubahan stok untuk "+p.name+". Gunakan angka positif untuk stok masuk atau negatif untuk stok keluar.");
  if(delta===null)return;const qty=Number(delta);if(!Number.isFinite(qty)||qty===0){status("Jumlah penyesuaian tidak valid.");return;}
  let cost=null;if(qty>0){const value=prompt("Harga modal per unit untuk stok masuk (Rp):");if(value===null)return;cost=Number(value);if(!Number.isFinite(cost)||cost<0){status("Harga modal tidak valid.");return;}}
  const reason=prompt("Alasan penyesuaian stok (wajib):");if(!reason)return;button.disabled=true;
  const {error}=await db.rpc("adjust_inventory_stock",{p_product_id:p.id,p_quantity_delta:qty,p_unit_cost:cost,p_reason:reason.trim()});
  if(error)status("Penyesuaian gagal: "+error.message);else{status("Stok berhasil disesuaikan dan tercatat di kartu stok.");await refreshAll();}
 }));
}
async function loadSuppliers(){
 const {data,error}=await db.from("suppliers").select("*").order("name");
 if(error)throw error;suppliers=data||[];
 $("invPurchaseSupplier").innerHTML=suppliers.filter(s=>s.is_active).map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(s.supplier_code)+'</option>').join("");
 $("invSupplierTable").innerHTML=suppliers.length?'<table><thead><tr><th>Kode</th><th>Supplier</th><th>Kontak</th><th>Telepon</th><th>Email</th><th>Status</th></tr></thead><tbody>'+suppliers.map(s=>'<tr><td>'+esc(s.supplier_code)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.contact_name||"—")+'</td><td>'+esc(s.phone||"—")+'</td><td>'+esc(s.email||"—")+'</td><td>'+(s.is_active?"Aktif":"Nonaktif")+'</td></tr>').join("")+'</tbody></table>':'<div class="inventory-empty">Belum ada supplier.</div>';
}
async function loadPurchases(){
 const {data,error}=await db.from("purchase_orders").select("id,purchase_number,purchase_date,due_date,status,payment_status,subtotal,additional_cost,total,amount_paid,balance_due,suppliers(name)").order("created_at",{ascending:false}).limit(100);
 if(error)throw error;
 $("invPurchaseTable").innerHTML=data?.length?'<table><thead><tr><th>No. Pembelian</th><th>Supplier</th><th>Tanggal</th><th>Total</th><th>Dibayar</th><th>Sisa hutang</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+data.map(p=>{
  const supplierName=p.suppliers?.name||"—";
  const action=p.status==="draft"?'<button type="button" data-receive-po="'+esc(p.id)+'">Terima barang</button>':'<button type="button" data-pay-po="'+esc(p.id)+'" '+(Number(p.balance_due)<=0?"disabled":"")+'>Catat pembayaran</button>';
  return '<tr><td><strong>'+esc(p.purchase_number)+'</strong></td><td>'+esc(supplierName)+'</td><td>'+esc(p.purchase_date)+'</td><td>'+money(p.total)+'</td><td>'+money(p.amount_paid)+'</td><td><strong>'+money(p.balance_due)+'</strong></td><td>'+esc(p.status)+' / '+esc(p.payment_status)+'</td><td>'+action+'</td></tr>';
 }).join("")+'</tbody></table>':'<div class="inventory-empty">Belum ada pembelian.</div>';
 $("invPurchaseTable").querySelectorAll("[data-receive-po]").forEach(button=>button.addEventListener("click",async()=>{
  if(!confirm("Terima seluruh barang pada pembelian ini? Stok dan HPP rata-rata akan diperbarui."))return;
  button.disabled=true;const {error}=await db.rpc("receive_inventory_purchase",{p_purchase_order_id:button.dataset.receivePo});
  if(error)status("Penerimaan barang gagal: "+error.message);else{status("Barang diterima. Stok dan HPP moving average berhasil diperbarui.");await refreshAll();}
 }));
 $("invPurchaseTable").querySelectorAll("[data-pay-po]").forEach(button=>button.addEventListener("click",async()=>{
  const p=data.find(x=>x.id===button.dataset.payPo),value=prompt("Sisa hutang "+p.purchase_number+": "+money(p.balance_due)+". Masukkan jumlah pembayaran:");
  if(value===null)return;const amount=Number(value);if(!Number.isFinite(amount)||amount<=0){status("Nominal pembayaran tidak valid.");return;}
  const method=prompt("Metode pembayaran (bank_transfer, cash, ewallet):","bank_transfer");if(!method)return;
  const reference=prompt("Nomor referensi pembayaran (opsional):","")||"";
  button.disabled=true;const {error}=await db.rpc("record_supplier_payment",{p_purchase_order_id:p.id,p_amount:amount,p_payment_method:method,p_reference_number:reference,p_notes:"Pembayaran hutang supplier"});
  if(error)status("Pembayaran gagal: "+error.message);else{status("Pembayaran supplier berhasil dicatat.");await loadPurchases();}
 }));
}
async function loadLedger(){
 const [moves,costs]=await Promise.all([
  db.from("inventory_movements").select("id,product_id,movement_type,quantity_in,quantity_out,unit_cost,balance_quantity,balance_cost,reference_type,notes,created_at,products(name,sku)").order("created_at",{ascending:false}).limit(100),
  db.from("product_cost_history").select("id,product_id,previous_cost,new_cost,previous_stock,new_stock,source_type,notes,created_at,products(name,sku)").order("created_at",{ascending:false}).limit(100)
 ]);
 if(moves.error)throw moves.error;if(costs.error)throw costs.error;
 $("invMovementTable").innerHTML=moves.data?.length?'<table><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th>Masuk</th><th>Keluar</th><th>HPP/unit</th><th>Saldo stok</th><th>Catatan</th></tr></thead><tbody>'+moves.data.map(m=>'<tr><td>'+new Date(m.created_at).toLocaleString("id-ID")+'</td><td>'+esc(m.products?.name||"—")+'</td><td>'+esc(m.movement_type)+'</td><td>'+Number(m.quantity_in).toLocaleString("id-ID")+'</td><td>'+Number(m.quantity_out).toLocaleString("id-ID")+'</td><td>'+money(m.unit_cost)+'</td><td>'+Number(m.balance_quantity).toLocaleString("id-ID")+'</td><td>'+esc(m.notes)+'</td></tr>').join("")+'</tbody></table>':'<div class="inventory-empty">Belum ada mutasi persediaan yang tercatat.</div>';
 $("invCostHistory").innerHTML=costs.data?.length?'<table><thead><tr><th>Waktu</th><th>Produk</th><th>HPP sebelumnya</th><th>HPP baru</th><th>Stok sebelum</th><th>Stok sesudah</th><th>Sumber</th></tr></thead><tbody>'+costs.data.map(c=>'<tr><td>'+new Date(c.created_at).toLocaleString("id-ID")+'</td><td>'+esc(c.products?.name||"—")+'</td><td>'+money(c.previous_cost)+'</td><td>'+money(c.new_cost)+'</td><td>'+Number(c.previous_stock).toLocaleString("id-ID")+'</td><td>'+Number(c.new_stock).toLocaleString("id-ID")+'</td><td>'+esc(c.source_type)+'</td></tr>').join("")+'</tbody></table>':'<div class="inventory-empty">Belum ada riwayat perubahan HPP.</div>';
}
async function refreshAll(){await Promise.all([loadProducts(),loadSuppliers(),loadPurchases(),loadLedger()]);}
function wireForms(){
 $("supplierForm").addEventListener("submit",async event=>{
  event.preventDefault();const form=event.currentTarget,f=form.elements,button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{const payload={supplier_code:f.supplier_code.value.trim().toUpperCase(),name:f.name.value.trim(),contact_name:f.contact_name.value.trim(),phone:f.phone.value.trim(),email:f.email.value.trim(),address:f.address.value.trim(),notes:f.notes.value.trim()};
   const {error}=await db.from("suppliers").insert(payload);if(error)throw error;form.reset();status("Supplier berhasil disimpan.");await loadSuppliers();
  }catch(error){status("Gagal menyimpan supplier: "+error.message);}finally{button.disabled=false;}
 });
 $("purchaseForm").addEventListener("submit",async event=>{
  event.preventDefault();const form=event.currentTarget,f=form.elements,button=form.querySelector('button[type="submit"]'),items=[...$("invPurchaseLines").children].map(row=>({product_id:row.querySelector(".inv-line-product").value,quantity:Number(row.querySelector(".inv-line-qty").value),unit_cost:Number(row.querySelector(".inv-line-cost").value)}));
  if(!items.length||items.some(item=>!item.product_id||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unit_cost)||item.unit_cost<0)){status("Periksa kembali item, jumlah, dan harga beli.");return;}
  button.disabled=true;
  try{const {data,error}=await db.rpc("create_inventory_purchase",{p_supplier_id:f.supplier_id.value,p_purchase_date:f.purchase_date.value||dateInput(),p_due_date:f.due_date.value||null,p_additional_cost:Number(f.additional_cost.value||0),p_notes:f.notes.value.trim(),p_items:items});if(error)throw error;form.reset();f.purchase_date.value=dateInput();$("invPurchaseLines").replaceChildren();addPurchaseLine();status("Draft pembelian "+data+" berhasil dibuat. Terima barang setelah barang fisik diperiksa.");await loadPurchases();
  }catch(error){status("Gagal membuat pembelian: "+error.message);}finally{button.disabled=false;}
 });
 $("invAddLine").addEventListener("click",addPurchaseLine);
 $("invRefreshStock").addEventListener("click",refreshAll);
}
async function init(){
 if(initialized)return;initialized=true;panelMarkup();
 if(previewMode){$("inventoryStatus").textContent="Mode pratinjau aman: seluruh operasi database dinonaktifkan agar preview tidak menulis ke Supabase production. Terapkan migrasi dan konfigurasi Supabase staging sebelum pengujian interaktif.";return;}
 const {data:{session}}=await db.auth.getSession();if(!session){status("Sesi admin tidak ditemukan. Silakan login ulang.");return;}
 const {data:profile,error}=await db.from("profiles").select("role").eq("id",session.user.id).single();
 if(error||!["admin","super_admin"].includes(profile?.role)){status("Akses modul persediaan hanya untuk Admin dan Super Admin.");return;}
 $("inventoryStatus").textContent="Menghubungkan ke database persediaan...";
 $("purchaseForm").elements.purchase_date.value=dateInput();wireForms();addPurchaseLine();
 try{await refreshAll();status("Modul persediaan siap. Metode HPP: Moving Average.");}
 catch(error){status("Backend persediaan belum siap: "+error.message+". Pastikan migration supabase/inventory-hpp-moving-average.sql sudah diterapkan pada database staging.");}
}
window.addEventListener("cms:inventory-open",()=>{if(!$("inventoryHppPanel"))init();});
