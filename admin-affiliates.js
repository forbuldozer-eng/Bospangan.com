import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>"Rp"+Number(v||0).toLocaleString("id-ID");
let mounted=false;
function mount(){
 if(mounted)return;mounted=true;
 const p=document.createElement("section");p.id="affiliateAdminPanel";p.className="panel hidden";
 p.innerHTML=`<h2>Affiliate Management</h2><p class="muted">Pengelolaan pengajuan, affiliate, komisi manual, dan pencairan.</p>
 <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
 <article class="stat-card"><div class="stat-top">Total Affiliate</div><strong id="affTotal">0</strong></article>
 <article class="stat-card"><div class="stat-top">Pengajuan Pending</div><strong id="affPending">0</strong></article>
 <article class="stat-card"><div class="stat-top">Komisi Tercatat</div><strong id="affTotalCommission">Rp0</strong></article></div>
 <div class="panel"><h3>Pengajuan Affiliate</h3><div id="affApplications">Memuat…</div></div>
 <div class="panel"><h3>Daftar Affiliate</h3><div id="affMembers">Memuat…</div></div>
 <div class="panel"><h3>Catat Komisi Manual</h3><form id="affCommissionForm"><div class="row"><label>Affiliate<select name="affiliate_id" id="affMemberSelect" required></select></label><label>Nominal (Rp)<input name="amount" type="number" min="1" step="1" required></label></div><label>Catatan / referensi<input name="note" maxlength="500" required></label><button class="primary">Simpan komisi</button></form></div>
 <div class="panel"><h3>Permintaan Pencairan</h3><div id="affWithdrawals">Memuat…</div></div><p id="affStatus" class="status" role="status">Modul affiliate siap.</p>`;
 $("adminView").append(p);
 $("affCommissionForm").addEventListener("submit",saveCommission);
}
const say=t=>{if($("affStatus"))$("affStatus").textContent=t;};
async function load(){
 mount();$("affiliateAdminPanel").classList.remove("hidden");
 try{
 const [a,m,c,w]=await Promise.all([
 db.from("affiliate_applications").select("*").order("created_at",{ascending:false}),
 db.from("affiliates").select("*").order("created_at",{ascending:false}),
 db.from("affiliate_commissions").select("amount,status"),
 db.from("affiliate_withdrawals").select("*").order("created_at",{ascending:false})
 ]);
 for(const x of [a,m,c,w])if(x.error)throw x.error;
 const apps=a.data||[],members=m.data||[],comm=c.data||[],withdrawals=w.data||[];
 $("affTotal").textContent=members.length;
 $("affPending").textContent=apps.filter(x=>x.status==="pending").length;
 $("affTotalCommission").textContent=money(comm.filter(x=>x.status!=="void").reduce((s,x)=>s+Number(x.amount),0));
 $("affApplications").innerHTML=apps.length?`<table><thead><tr><th>Nama / Email</th><th>WhatsApp</th><th>Kanal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${apps.map(x=>`<tr><td>${esc(x.applicant_name)}<br><small>${esc(x.applicant_email)}</small></td><td>${esc(x.whatsapp)}</td><td>${esc(x.promotion_channel)}<br><small>${esc(x.reason)}</small></td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<button data-review-app="${x.id}" data-decision="approved">Setujui</button> <button data-review-app="${x.id}" data-decision="rejected">Tolak</button>`:"—"}</td></tr>`).join("")}</tbody></table>`:"<p class='muted'>Belum ada pengajuan.</p>";
 $("affMembers").innerHTML=members.length?`<table><thead><tr><th>Kode</th><th>User ID</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>${members.map(x=>`<tr><td><strong>${esc(x.affiliate_code)}</strong></td><td><small>${esc(x.user_id)}</small></td><td>${esc(x.status)}</td><td>${new Date(x.created_at).toLocaleDateString("id-ID")}</td></tr>`).join("")}</tbody></table>`:"<p class='muted'>Belum ada affiliate.</p>";
 $("affMemberSelect").innerHTML=members.filter(x=>x.status==="active").map(x=>`<option value="${x.id}">${esc(x.affiliate_code)} — ${esc(x.user_id.slice(0,8))}</option>`).join("");
 $("affWithdrawals").innerHTML=withdrawals.length?`<table><thead><tr><th>Affiliate</th><th>Nominal</th><th>Tujuan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${withdrawals.map(x=>`<tr><td>${esc(members.find(m=>m.id===x.affiliate_id)?.affiliate_code||x.affiliate_id)}</td><td>${money(x.amount)}</td><td>${esc(x.payment_method)} · ${esc(x.payment_account_name)}<br>${esc(x.payment_account_number)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<button data-review-withdraw="${x.id}" data-decision="approved">Setujui</button> <button data-review-withdraw="${x.id}" data-decision="rejected">Tolak</button>`:x.status==="approved"?`<button data-review-withdraw="${x.id}" data-decision="paid">Tandai dibayar</button>`:"—"}</td></tr>`).join("")}</tbody></table>`:"<p class='muted'>Belum ada permintaan pencairan.</p>";
 document.querySelectorAll("[data-review-app]").forEach(b=>b.onclick=()=>reviewApp(b.dataset.reviewApp,b.dataset.decision));
 document.querySelectorAll("[data-review-withdraw]").forEach(b=>b.onclick=()=>reviewWithdrawal(b.dataset.reviewWithdraw,b.dataset.decision));
 say("Data affiliate berhasil dimuat.");
 }catch(e){const detail=String(e?.message||e||"Kesalahan tidak diketahui");for(const id of ["affApplications","affMembers","affWithdrawals"])if($(id))$(id).innerHTML=`<p class="error">Data belum dapat dimuat: ${esc(detail)}<br><small>Pastikan migration affiliate sudah dijalankan pada project Supabase yang dipakai Preview.</small></p>`;if($("affMemberSelect"))$("affMemberSelect").innerHTML=`<option value="">Database affiliate belum siap</option>`;say("Gagal memuat data affiliate: "+detail);}
}
async function reviewApp(id,decision){
 const code=decision==="approved"?prompt("Kode affiliate (minimal 4 karakter):"):"";
 if(decision==="approved"&&!code)return;
 const note=prompt("Catatan review (opsional):")||"";
 const {error}=await db.rpc("admin_review_affiliate_application",{p_application_id:id,p_decision:decision,p_affiliate_code:code||"",p_note:note});
 if(error){say(error.message);return;}say("Pengajuan diproses.");await load();
}
async function saveCommission(e){
 e.preventDefault();const f=e.currentTarget,d=new FormData(f),{data:{user}}=await db.auth.getUser();
 const {error}=await db.from("affiliate_commissions").insert({affiliate_id:d.get("affiliate_id"),amount:Number(d.get("amount")),note:String(d.get("note")).trim(),created_by:user?.id});
 if(error){say(error.message);return;}f.reset();say("Komisi berhasil dicatat.");await load();
}
async function reviewWithdrawal(id,decision){
 const note=prompt(decision==="paid"?"Catatan pembayaran / referensi transfer (opsional):":"Catatan review (opsional):")||"",{data:{user}}=await db.auth.getUser();
 const allowedPrevious=decision==="paid"?"approved":"pending";
 const {error}=await db.from("affiliate_withdrawals").update({status:decision,reviewed_by:user?.id,reviewed_at:new Date().toISOString(),review_note:note}).eq("id",id).eq("status",allowedPrevious);
 if(error){say(error.message);return;}say("Status pencairan diperbarui.");await load();
}
mount();window.addEventListener("cms:affiliate-open",load);
