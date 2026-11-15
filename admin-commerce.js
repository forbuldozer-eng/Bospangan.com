import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categories = ["Daging sapi","Ikan","Ayam","Sayuran","Minyak","Beras","Bumbu dapur","Buah"];
const money = n => "Rp" + Number(n || 0).toLocaleString("id-ID");
let user, role, editingId = null;

function panelMarkup() {
  const section = document.createElement("section");
  section.className = "panel";
  section.id = "commerceAdmin";
  section.innerHTML = `
    <h2>Commerce Control Center</h2>
    <p class="muted">Pengelolaan katalog, SKU, pajak, pesanan, transaksi khusus, dan campaign Bos Pangan.</p>
    <div class="tabs" style="margin:12px 0">
      <button type="button" data-tab="products" class="active">Produk</button>
      <button type="button" data-tab="orders">Transaksi</button>
      <button type="button" data-tab="campaigns">Email & Push</button>
      <button type="button" data-tab="settings" class="${role === "super_admin" ? "" : "hidden"}">Pengaturan</button>
    </div>
    <p id="commerceStatus" class="status" role="status">Panel siap.</p>
    <div id="tab-products">
      <form id="productForm" class="panel">
        <h3 id="productFormTitle">Tambah produk</h3>
        <div class="row">
          <label>Nama produk<input name="name" maxlength="160" required></label>
          <label>SKU<input name="sku" maxlength="64" required></label>
        </div>
        <div class="row">
          <label>Kategori<select name="category" required>${categories.map(c=>'<option>'+c+'</option>').join("")}</select></label>
          <label>Harga (Rp)<input name="price" type="number" min="0" step="0.01" required></label>
          <label>Stok<input name="stock" type="number" min="0" step="0.001" value="0" required></label>
          <label>Satuan<input name="unit" maxlength="24" value="pcs" required></label>
        </div>
        <label>Deskripsi<textarea name="description" rows="3" maxlength="5000"></textarea></label>
        <div class="row">
          <label>Pajak produk (%)<input name="tax_percent" type="number" min="0" max="100" step="0.01" placeholder="Kosongkan untuk ikut pajak default"></label>
          <label>Video YouTube (URL)<input name="youtube_url" type="url" placeholder="https://www.youtube.com/watch?v=..."></label>
        </div>
        <label>Foto produk (maksimal 5; JPG, PNG, WebP; maks. 8 MB/foto)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
        <div class="row"><label><span><input name="is_published" type="checkbox" style="width:auto"> Publikasikan produk</span></label><label><span><input name="is_featured" type="checkbox" style="width:auto"> Produk unggulan</span></label></div>
        <div class="row"><button class="primary" type="submit">Simpan produk</button><button type="button" id="cancelEdit">Reset form</button></div>
        <div id="currentImages" class="muted"></div>
      </form>
      <div id="productsTable" class="table-wrap"></div>
    </div>
    <div id="tab-orders" class="hidden">
      <h3>Daftar transaksi</h3><p class="muted">Termasuk pesanan reguler dan permintaan transaksi khusus/penawaran.</p>
      <div id="ordersTable" class="table-wrap"></div>
    </div>
    <div id="tab-campaigns" class="hidden">
      <form id="campaignForm" class="panel">
        <h3>Buat campaign produk</h3>
        <label>Produk<select name="product_id" id="campaignProduct" required></select></label>
        <label>Judul campaign<input name="title" maxlength="140" required></label>
        <label>Subject email<input name="subject" maxlength="180" required></label>
        <label>Isi pesan<textarea name="body_html" rows="5" required placeholder="Tulis informasi produk dan ajakan yang jelas."></textarea></label>
        <div class="row">
          <label>Channel<select name="channel"><option value="email">Email</option><option value="push">Push notification</option><option value="both">Email + Push</option></select></label>
          <label>Target<select name="audience"><option value="product_subscribers">Pelanggan yang memilih notifikasi produk ini</option><option value="all_opted_in">Semua pelanggan yang memberi izin</option></select></label>
          <label>Jadwal (opsional)<input name="scheduled_at" type="datetime-local"></label>
        </div>
        <button class="primary">Simpan campaign</button>
      </form>
      <div id="campaignsTable" class="table-wrap"></div>
      <div class="panel" style="margin-top:16px">
        <div class="row" style="align-items:center;justify-content:space-between">
          <h3>Log notifikasi email pesanan</h3>
          <button id="refreshNotificationQueue" type="button">Perbarui log</button>
        </div>
        <p class="muted">Memantau email pemberitahuan transaksi baru yang dikirim ke alamat owner.</p>
        <div id="notificationQueueTable" class="table-wrap">Memuat log notifikasi...</div>
      </div>
    </div>
    <div id="tab-settings" class="${role === "super_admin" ? "" : "hidden"}">
      <form id="settingsForm" class="panel">
        <h3>Pengaturan toko (Super Admin)</h3>
        <label>Email owner untuk notifikasi transaksi<input name="owner_email" type="email" maxlength="254" required></label>
        <label>Pajak default katalog (%)<input name="tax_percent" type="number" min="0" max="100" step="0.01" required></label>
        <label><span><input name="email_enabled" type="checkbox" style="width:auto"> Aktifkan notifikasi email</span></label>
        <label><span><input name="push_enabled" type="checkbox" style="width:auto"> Aktifkan push notification</span></label>
        <button class="primary" type="submit">Simpan pengaturan</button><p id="settingsStatus" class="status" role="status" aria-live="polite"></p>
      </form>
    </div>`;
  $("adminView").append(section);
  section.querySelectorAll("[data-tab]").forEach(button => button.onclick = () => {
    section.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b===button));
    ["products","orders","campaigns","settings"].forEach(tab=>$("tab-"+tab).classList.toggle("hidden",tab!==button.dataset.tab));
  });
  return section;
}
function message(text){$("commerceStatus").textContent=text;}
function slugify(value){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,150);}
function resetForm(){
  editingId=null;$("productForm").reset();$("productFormTitle").textContent="Tambah produk";$("currentImages").textContent="";
}
async function uploadImages(files, oldUrls=[]){
  if(files.length>5) throw new Error("Maksimal 5 foto produk.");
  const urls=[...oldUrls];
  for(const file of files){
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Format foto harus JPG, PNG, atau WebP.");
    if(file.size>8*1024*1024) throw new Error("Ukuran setiap foto maksimal 8 MB.");
    const path=`${crypto.randomUUID()}-${slugify(file.name)}`;
    const {error}=await db.storage.from("product-images").upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    const {data}=db.storage.from("product-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  if(urls.length>5) throw new Error("Total foto produk maksimal 5.");
  return urls;
}
async function loadProducts(){
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error)throw error;
  $("productsTable").innerHTML=data.length?'<table><thead><tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
    data.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku)+'</td><td>'+esc(p.category)+'</td><td>'+money(p.price)+'</td><td>'+(p.is_published?"Tayang":"Draft")+'</td><td><button data-edit="'+p.id+'">Edit</button> <button data-delete="'+p.id+'">Hapus</button></td></tr>').join("")+'</tbody></table>':'<p class="muted">Belum ada produk dari dashboard.</p>';
  $("campaignProduct").innerHTML=data.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+esc(p.sku)+'</option>').join("");
  $("productsTable").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editProduct(data.find(p=>p.id===b.dataset.edit)));
  $("productsTable").querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Hapus produk ini? Riwayat transaksi akan tetap menyimpan snapshot produk."))return;const {error}=await db.from("products").delete().eq("id",b.dataset.delete);if(error)message(error.message);else{message("Produk dihapus.");await loadProducts();}});
}
function renderCurrentImages(urls = []) {
  const root = $("currentImages");
  root.replaceChildren();

  const heading = document.createElement("p");
  heading.textContent = urls.length
    ? `Foto tersimpan: ${urls.length}/5`
    : "Belum ada foto tersimpan.";
  root.append(heading);

  if (!urls.length) return;

  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;margin:10px 0";
  const projectOrigin = new URL(SUPABASE_URL).origin;
  const publicPath = "/storage/v1/object/public/product-images/";

  urls.forEach((url, index) => {
    const card = document.createElement("div");
    card.style.cssText = "width:132px;padding:6px;border:1px solid #dce5d8;border-radius:8px;background:#fff";

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      parsedUrl = null;
    }

    if (!parsedUrl || parsedUrl.origin !== projectOrigin || !parsedUrl.pathname.includes(publicPath)) {
      const warning = document.createElement("p");
      warning.textContent = `Foto ${index + 1}: URL foto tidak valid.`;
      card.append(warning);
    } else {
      const link = document.createElement("a");
      link.href = parsedUrl.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = "Buka foto ukuran penuh";

      const image = document.createElement("img");
      image.src = parsedUrl.href;
      image.alt = `Foto produk ${index + 1}`;
      image.loading = "lazy";
      image.style.cssText = "display:block;width:120px;height:120px;object-fit:cover;border-radius:6px;background:#f3f5f1";
      image.onerror = () => {
        const warning = document.createElement("p");
        warning.textContent = `Foto ${index + 1} gagal dimuat. Periksa bucket product-images di Supabase Storage.`;
        card.replaceChildren(warning);
      };

      link.append(image);
      card.append(link);
    }

    const caption = document.createElement("small");
    caption.textContent = `Foto ${index + 1}`;
    card.append(caption);
    grid.append(card);
  });

  root.append(grid);

  const note = document.createElement("p");
  note.textContent = "Foto baru akan ditambahkan; total maksimal 5 foto. Klik foto untuk membuka ukuran penuh.";
  root.append(note);
}
function editProduct(p){
  editingId=p.id;const f=$("productForm").elements;
  for(const key of ["name","sku","category","price","stock","unit","description","tax_percent","youtube_url"])f[key].value=p[key]??"";
  f.is_published.checked=p.is_published;f.is_featured.checked=p.is_featured;
  $("productFormTitle").textContent="Edit produk · "+p.sku;
  renderCurrentImages(p.image_urls || []);
  window.scrollTo({top:$("commerceAdmin").offsetTop,behavior:"smooth"});
}
$("commerceAdmin") || null;
async function loadOrders(){
  const {data,error}=await db.from("orders")
    .select("id,order_number,customer_name,customer_email,customer_phone,customer_address,transaction_type,total,tax_amount,status,payment_status,created_at,special_request,order_items(sku_snapshot,product_name_snapshot,quantity,unit_price,line_subtotal,tax_percent,tax_amount)")
    .order("created_at",{ascending:false}).limit(100);
  if(error)throw error;

  const canCancel = (order) => order.payment_status === "unpaid" && (
    (order.transaction_type === "regular" && ["new","confirmed","processing"].includes(order.status)) ||
    (order.transaction_type === "special" && order.status === "quoted")
  );

  $("ordersTable").innerHTML=data.length
    ? '<table><thead><tr><th>Nomor</th><th>Pelanggan & alamat</th><th>Rincian</th><th>Jenis</th><th>Total / pajak</th><th>Status</th><th>Ubah status</th><th>Aksi</th></tr></thead><tbody>'+
      data.map(o=>{
        const items=(o.order_items||[]).map(item=>esc(item.product_name_snapshot)+' × '+esc(item.quantity)+' <small>('+esc(item.sku_snapshot)+')</small><br><small>Pajak '+esc(item.tax_percent)+'% · '+money(item.tax_amount)+'</small>').join('<br>')||'—';
        const cancelAction=canCancel(o)
          ? '<button type="button" data-cancel-order="'+esc(o.id)+'">Batalkan</button>'
          : '<small>—</small>';
        return '<tr><td>'+esc(o.order_number)+'<br><small>'+new Date(o.created_at).toLocaleString("id-ID")+'</small></td>'+
          '<td>'+esc(o.customer_name)+'<br>'+esc(o.customer_email)+'<br>'+esc(o.customer_phone)+'<br><small>'+esc(o.customer_address||"Alamat belum diberikan")+'</small></td>'+
          '<td>'+items+'</td>'+
          '<td>'+esc(o.transaction_type)+(o.special_request?'<br><small>'+esc(o.special_request)+'</small>':"")+'</td>'+
          '<td>'+money(o.total)+'<br><small>Pajak '+money(o.tax_amount)+'</small></td>'+
          '<td>'+esc(o.status)+' / '+esc(o.payment_status)+'</td>'+
          '<td><select data-order-status="'+esc(o.id)+'"><option value="new">Menunggu</option><option value="quoted">Menunggu penawaran</option><option value="confirmed">Dikonfirmasi</option><option value="processing">Diproses</option><option value="shipped">Dikirim</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></td>'+
          '<td>'+cancelAction+'</td></tr>';
      }).join("")+'</tbody></table>'
    : '<p class="muted">Belum ada transaksi.</p>';

  $("ordersTable").querySelectorAll("[data-order-status]").forEach(sel=>{
    const order=data.find(x=>x.id===sel.dataset.orderStatus);
    sel.value=order.status;
    sel.onchange=async()=>{
      const nextStatus=sel.value;
      if(nextStatus==="cancelled" && !canCancel(order)){
        message("Pesanan ini tidak dapat dibatalkan dari status atau pembayaran saat ini.");
        sel.value=order.status;
        return;
      }
      if(nextStatus==="cancelled" && !confirm("Batalkan pesanan "+order.order_number+"? Stok produk yang dipesan akan dikembalikan.")){
        sel.value=order.status;
        return;
      }
      sel.disabled=true;
      const {error:updateError}=await db.from("orders")
        .update({status:nextStatus,updated_at:new Date().toISOString()})
        .eq("id",order.id)
        .select("id,status")
        .single();
      if(updateError){
        message("Gagal memperbarui status: "+updateError.message);
        await loadOrders();
        return;
      }
      message(nextStatus==="cancelled" ? "Pesanan dibatalkan. Stok terkait dikembalikan." : "Status transaksi diperbarui.");
      await loadOrders();
      if(nextStatus==="cancelled") await loadProducts();
    };
  });

  $("ordersTable").querySelectorAll("[data-cancel-order]").forEach(button=>{
    button.onclick=async()=>{
      const order=data.find(x=>x.id===button.dataset.cancelOrder);
      if(!order || !canCancel(order))return;
      if(!confirm("Batalkan pesanan "+order.order_number+"? Stok produk yang dipesan akan dikembalikan."))return;
      button.disabled=true;
      const {error:updateError}=await db.from("orders")
        .update({status:"cancelled",updated_at:new Date().toISOString()})
        .eq("id",order.id)
        .select("id,status")
        .single();
      if(updateError){
        message("Gagal membatalkan pesanan: "+updateError.message);
        await loadOrders();
        return;
      }
      message("Pesanan dibatalkan. Stok produk telah dikembalikan ke katalog.");
      await Promise.all([loadOrders(),loadProducts()]);
    };
  });
}
async function loadCampaigns(){
  const {data,error}=await db.from("product_campaigns").select("id,title,subject,channel,audience,status,scheduled_at,created_at").order("created_at",{ascending:false}).limit(50);
  if(error)throw error;
  $("campaignsTable").innerHTML=data.length?'<table><thead><tr><th>Campaign</th><th>Channel / Target</th><th>Status</th><th>Jadwal</th><th>Aksi</th></tr></thead><tbody>'+
   data.map(c=>'<tr><td>'+esc(c.title)+'<br><small>'+esc(c.subject)+'</small></td><td>'+esc(c.channel)+' / '+esc(c.audience)+'</td><td>'+esc(c.status)+'</td><td>'+esc(c.scheduled_at||"—")+'</td><td>'+(c.status==="draft"||c.status==="scheduled"?'<button data-send-campaign="'+c.id+'">Kirim sekarang</button>':"—")+'</td></tr>').join("")+'</tbody></table>':'<p class="muted">Belum ada campaign.</p>';
  $("campaignsTable").querySelectorAll("[data-send-campaign]").forEach(b=>b.onclick=async()=>{if(!confirm("Kirim campaign ini kepada pelanggan yang sudah memberi izin?"))return;b.disabled=true;const {data:{session}}=await db.auth.getSession();const response=await fetch(SUPABASE_URL+"/functions/v1/send-product-campaign",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({campaign_id:b.dataset.sendCampaign})});const result=await response.json().catch(()=>({}));message(response.ok?"Campaign diproses. "+(result.sent??0)+" email terkirim.":(result.error||"Gagal mengirim campaign."));b.disabled=false;await loadCampaigns();});
}
async function loadNotificationQueue(){
  const target=$("notificationQueueTable");
  if(!target)return;
  target.textContent="Memuat log notifikasi...";
  const {data,error}=await db.from("notification_queue")
    .select("id,recipient_email,subject,status,attempts,last_error,created_at,sent_at")
    .eq("event_type","new_order")
    .order("created_at",{ascending:false})
    .limit(30);
  if(error)throw error;
  if(!data?.length){
    target.innerHTML='<p class="muted">Belum ada notifikasi pesanan. Pastikan email owner sudah diisi di Pengaturan dan simpan pengaturan tersebut.</p>';
    return;
  }
  const labels={pending:"Menunggu",processing:"Sedang dikirim",sent:"Terkirim",failed:"Gagal"};
  target.innerHTML='<table><thead><tr><th>Waktu</th><th>Penerima</th><th>Subjek</th><th>Status</th><th>Detail</th></tr></thead><tbody>'+
    data.map(item=>{
      const detail=item.status==="failed"
        ? (item.last_error||"Pengiriman gagal")
        : item.status==="sent"
          ? ("Terkirim "+(item.sent_at?new Date(item.sent_at).toLocaleString("id-ID"):""))
          : ("Percobaan: "+Number(item.attempts||0));
      return '<tr><td>'+esc(new Date(item.created_at).toLocaleString("id-ID"))+
        '</td><td>'+esc(item.recipient_email)+
        '</td><td>'+esc(item.subject)+
        '</td><td>'+esc(labels[item.status]||item.status)+
        '</td><td><small>'+esc(detail)+'</small></td></tr>';
    }).join("")+'</tbody></table>';
}
async function loadSettings(){
  if(role!=="super_admin")return;
  const {data,error}=await db.from("store_settings").select("key,value");
  if(error)throw error;const v=Object.fromEntries(data.map(x=>[x.key,x.value]));
  const f=$("settingsForm").elements;
  f.owner_email.value=String(v.owner_notification_email||"").replace(/^"|"$/g,"");
  f.tax_percent.value=Number(v.default_tax_percent??0);
  f.email_enabled.checked=v.email_notifications_enabled!==false;
  f.push_enabled.checked=v.push_notifications_enabled!==false;
}
$("commerceAdmin")?.addEventListener("submit",()=>{});
function wireForms(){
  $("refreshNotificationQueue")?.addEventListener("click",async()=>{
    const button=$("refreshNotificationQueue");
    button.disabled=true;
    try{await loadNotificationQueue();message("Log notifikasi diperbarui.");}
    catch(err){message("Gagal memuat log notifikasi: "+(err.message||err));}
    finally{button.disabled=false;}
  });
  $("productForm").onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget.elements;const button=e.submitter;button.disabled=true;
    try{
      const existing=editingId?(await db.from("products").select("image_urls").eq("id",editingId).single()).data:null;
      const selected=[...f.images.files];const images=await uploadImages(selected,existing?.image_urls||[]);
      const name=f.name.value.trim(),sku=f.sku.value.trim().toUpperCase();
      const payload={name,sku,slug:slugify(name)+"-"+slugify(sku),category:f.category.value,price:Number(f.price.value),stock:Number(f.stock.value),unit:f.unit.value.trim(),description:f.description.value.trim(),tax_percent:f.tax_percent.value===""?null:Number(f.tax_percent.value),youtube_url:f.youtube_url.value.trim()||null,image_urls:images,is_published:f.is_published.checked,is_featured:f.is_featured.checked,updated_by:user.id};
      if(editingId){const {error}=await db.from("products").update(payload).eq("id",editingId);if(error)throw error;}
      else{payload.created_by=user.id;const {error}=await db.from("products").insert(payload);if(error)throw error;}
      resetForm();message("Produk berhasil disimpan.");await loadProducts();
    }catch(err){message("Gagal menyimpan produk: "+(err.message||err));}finally{button.disabled=false;}
  };
  $("cancelEdit").onclick=resetForm;
  $("campaignForm").onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    const payload={product_id:f.product_id.value,title:f.title.value.trim(),subject:f.subject.value.trim(),body_html:f.body_html.value.trim(),channel:f.channel.value,audience:f.audience.value,status:f.scheduled_at.value?"scheduled":"draft",scheduled_at:f.scheduled_at.value?new Date(f.scheduled_at.value).toISOString():null,created_by:user.id};
    const {error}=await db.from("product_campaigns").insert(payload);if(error)message(error.message);else{e.currentTarget.reset();message("Campaign disimpan. Admin dapat mengirimnya setelah ditinjau.");await loadCampaigns();}
  };
  $("settingsForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    if(role!=="super_admin")return;

    const form=e.currentTarget;
    const f=form.elements;
    const status=$("settingsStatus");
    const button=form.querySelector('button[type="submit"]');
    const originalLabel=button?.textContent||"Simpan pengaturan";
    const rows=[
      ["owner_notification_email",f.owner_email.value.trim()],
      ["default_tax_percent",Number(f.tax_percent.value)],
      ["email_notifications_enabled",f.email_enabled.checked],
      ["push_notifications_enabled",f.push_enabled.checked]
    ];

    if(status)status.textContent="Menyimpan pengaturan toko...";
    message("Menyimpan pengaturan toko...");
    if(button){button.disabled=true;button.textContent="Menyimpan...";}

    try{
      const {error}=await db.from("store_settings").upsert(
        rows.map(([key,value])=>({
          key,
          value,
          updated_by:user.id,
          updated_at:new Date().toISOString()
        })),
        {onConflict:"key"}
      );
      if(error)throw error;

      if(status)status.textContent="Pengaturan toko berhasil disimpan.";
      message("Pengaturan toko berhasil disimpan.");

      try{
        await loadSettings();
      }catch(refreshError){
        if(status)status.textContent="Pengaturan tersimpan, tetapi pembacaan ulang gagal: "+(refreshError.message||refreshError);
      }
    }catch(err){
      const detail=err?.message||String(err);
      if(status)status.textContent="Gagal menyimpan pengaturan: "+detail;
      message("Gagal menyimpan pengaturan: "+detail);
    }finally{
      if(button){button.disabled=false;button.textContent=originalLabel;}
    }
  });
}
async function init(){
 const {data:{session}}=await db.auth.getSession();if(!session)return;
 user=session.user;const {data:profile,error}=await db.from("profiles").select("role").eq("id",user.id).single();
 if(error||!["admin","super_admin"].includes(profile?.role))return;
 role=profile.role;
 $("adminView").classList.remove("hidden");
 const section=panelMarkup();wireForms();
 try{await Promise.all([loadProducts(),loadOrders(),loadCampaigns(),loadSettings(),loadNotificationQueue()]);message("Commerce Control Center siap.");}
 catch(err){message("Backend belum sepenuhnya aktif: "+(err.message||err)+". Pastikan migration SQL sudah dijalankan.");}
}
init().catch(e=>console.error("Bos Pangan commerce admin:",e));
