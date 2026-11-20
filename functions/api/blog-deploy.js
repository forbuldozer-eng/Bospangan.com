function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }});
}
export async function onRequestPost({ request, env }) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({error:"Sesi admin tidak ditemukan."},401);
  const origin = request.headers.get("Origin");
  if (origin) {
    let host = "";
    try { host = new URL(origin).hostname.toLowerCase(); } catch {}
    if (!(host === "bospangan.com" || host === "www.bospangan.com" || host.endsWith(".bospangan-com.pages.dev"))) {
      return json({error:"Origin tidak diizinkan."},403);
    }
  }
  const hookUrl = env.BLOG_DEPLOY_HOOK_URL;
  if (!hookUrl) return json({error:"Deploy Hook belum dikonfigurasi. Tambahkan secret BLOG_DEPLOY_HOOK_URL di Cloudflare."},503);
  let hook;
  try { hook = new URL(hookUrl); if (hook.protocol !== "https:") throw new Error(); }
  catch { return json({error:"URL Deploy Hook tidak valid."},500); }

  const configResponse = await env.ASSETS.fetch(new Request(new URL("/auth-config.js",request.url)));
  if (!configResponse.ok) return json({error:"Konfigurasi Supabase tidak tersedia."},500);
  const configText = await configResponse.text();
  const urlMatch = configText.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const keyMatch = configText.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/);
  if (!urlMatch || !keyMatch) return json({error:"Konfigurasi Supabase tidak lengkap."},500);
  const supabaseUrl = urlMatch[1].replace(/\/$/,"");
  const publicKey = keyMatch[1];

  const userResponse = await fetch(supabaseUrl+"/auth/v1/user",{headers:{apikey:publicKey,Authorization:authorization}});
  if (!userResponse.ok) return json({error:"Sesi admin tidak valid atau sudah kedaluwarsa."},401);
  const user = await userResponse.json();

  const profileUrl = new URL(supabaseUrl+"/rest/v1/profiles");
  profileUrl.searchParams.set("select","role");
  profileUrl.searchParams.set("id","eq."+user.id);
  const profileResponse = await fetch(profileUrl,{headers:{apikey:publicKey,Authorization:authorization,Accept:"application/json"}});
  if (!profileResponse.ok) return json({error:"Hak akses CMS tidak dapat diverifikasi."},502);
  const profiles = await profileResponse.json();
  if (!["admin","super_admin"].includes(profiles?.[0]?.role)) {
    return json({error:"Hanya Admin atau Super Admin yang dapat memicu build Blog."},403);
  }

  const deployResponse = await fetch(hook.toString(),{method:"POST"});
  if (!deployResponse.ok) return json({error:"Cloudflare menolak pemicu build (HTTP "+deployResponse.status+")."},502);
  return json({ok:true,message:"Build Cloudflare dipicu; halaman HTML statis akan diperbarui setelah deployment selesai."});
}
