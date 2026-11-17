const allowedOrigins = new Set([
  "https://www.bospangan.com",
  "https://bospangan.com",
  "https://bospangancom-theta.vercel.app",
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
]);

function response(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://www.bospangan.com";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Headers": "apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response(req, {}, 204);
  if (req.method !== "POST") return response(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (!allowedOrigins.has(origin)) return response(req, { error: "Origin tidak diizinkan." }, 403);

  const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    serviceKey = String(keys.default ?? serviceKey);
  } catch { /* use legacy service-role secret when configured */ }
  if (!projectUrl || !serviceKey) return response(req, { error: "Konfigurasi server Supabase belum lengkap." }, 500);

  async function db(path: string, method = "GET", body?: unknown) {
    const res = await fetch(projectUrl.replace(/\/+$/, "") + "/rest/v1/" + path, {
      method,
      headers: {
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await res.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!res.ok) throw new Error("Database request failed (" + res.status + ")");
    return data;
  }

  try {
    const raw = await req.text();
    if (raw.length > 12000) return response(req, { error: "Permintaan terlalu besar." }, 413);
    const input = JSON.parse(raw);
    const action = String(input.action ?? "");
    if (String(input.company_website ?? "").trim()) return response(req, { error: "Permintaan tidak valid." }, 400);

    if (action === "register") {
      const name = String(input.name ?? "").trim().slice(0, 120);
      const email = String(input.email ?? "").trim().toLowerCase().slice(0, 254);
      const website = String(input.website ?? "").trim().slice(0, 500);
      const referralCode = String(input.referral_code ?? "").trim().slice(0, 80);
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return response(req, { error: "Nama dan email yang valid wajib diisi." }, 400);
      }
      if (website && !/^https:\/\//i.test(website)) {
        return response(req, { error: "Website harus menggunakan HTTPS." }, 400);
      }
      let parentId = null;
      if (referralCode) {
        const parent = await db("affiliates?select=id&ref_id=eq." + encodeURIComponent(referralCode) + "&status=eq.active&limit=1");
        parentId = parent?.[0]?.id ?? null;
      }
      const rows = await db("affiliates", "POST", [{ name, email, website, referred_by: parentId, ref_id: crypto.randomUUID(), status: "active" }]);
      const affiliate = rows?.[0];
      if (!affiliate?.ref_id) throw new Error("Pendaftaran afiliasi gagal disimpan.");
      return response(req, {
        success: true,
        status: "active",
        referral_code: affiliate.ref_id,
        affiliate_link: "https://www.bospangan.com/?ref=" + affiliate.ref_id,
        message: "Pendaftaran afiliasi berhasil. Tautan referral sudah aktif.",
      }, 201);
    }

    const refId = String(input.ref_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(refId)) {
      return response(req, { error: "Kode referral tidak valid." }, 400);
    }
    const affiliates = await db("affiliates?select=id,status&ref_id=eq." + encodeURIComponent(refId) + "&limit=1");
    const affiliate = affiliates?.[0];
    if (!affiliate || affiliate.status !== "active") return response(req, { error: "Kode referral belum aktif." }, 404);

    if (action === "click") {
      const referrer = String(input.referrer ?? "").slice(0, 1000);
      await db("affiliate_clicks", "POST", [{ affiliate_id: affiliate.id, referrer }]);
      return response(req, { success: true });
    }

    if (action === "stats") {
      const clicks = await db("affiliate_clicks?select=id&affiliate_id=eq." + affiliate.id);
      const conversions = await db("affiliate_conversions?select=order_total&affiliate_id=eq." + affiliate.id);
      const total = (conversions ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
      return response(req, {
        success: true,
        clicks: (clicks ?? []).length,
        conversions: (conversions ?? []).length,
        attributed_sales: total,
      });
    }
    return response(req, { error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("affiliate:", error);
    return response(req, { error: "Layanan afiliasi sedang mengalami kendala." }, 500);
  }
});
