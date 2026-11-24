const allowedOrigins = new Set([
  "https://bospangan-com.pages.dev",
  "https://bospangan.com",
  "https://www.bospangan.com",
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string,string> = {
    "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors(req), "Content-Type": "application/json" },
  });
}
function validPostal(value: unknown) {
  return /^\d{5}$/.test(String(value ?? "").trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (!allowedOrigins.has(origin)) return reply(req, { error: "Origin tidak diizinkan." }, 403);

  const apiKey = Deno.env.get("BITESHIP_API_KEY") ?? "";
  const originPostal = Deno.env.get("BOSPANGAN_ORIGIN_POSTAL_CODE") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!apiKey || !validPostal(originPostal) || !supabaseUrl || !serviceKey) {
    return reply(req, {
      configured: false,
      error: "Integrasi ongkir belum aktif. Admin perlu mengatur API key Biteship dan kode pos gudang di Edge Function Secrets.",
    }, 503);
  }

  try {
    const input = await req.json();
    const destinationPostal = String(input.destination_postal_code ?? "").trim();
    const productIds = Array.isArray(input.product_ids) ? [...new Set(input.product_ids.map(String))] : [];
    if (!validPostal(destinationPostal)) return reply(req, { error: "Masukkan kode pos tujuan 5 digit." }, 400);
    if (!productIds.length || productIds.length > 50 || productIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
      return reply(req, { error: "Daftar produk tidak valid." }, 400);
    }

    // Product weights and dimensions are loaded from the database, never trusted from the browser.
    const url = new URL("/rest/v1/products", supabaseUrl);
    url.searchParams.set("select", "id,name,description,price,weight_grams,length_cm,width_cm,height_cm");
    url.searchParams.set("id", "in.(" + productIds.join(",") + ")");
    url.searchParams.set("is_published", "eq.true");
    const dbResponse = await fetch(url, { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } });
    if (!dbResponse.ok) throw new Error("Tidak dapat membaca data berat produk.");
    const products = await dbResponse.json();
    if (!Array.isArray(products) || products.length !== productIds.length) {
      return reply(req, { error: "Sebagian produk tidak ditemukan atau tidak tersedia." }, 400);
    }

    const quantities = input.quantities && typeof input.quantities === "object" ? input.quantities : {};
    const items = products.map((product: any) => {
      const quantity = Number(quantities[product.id]);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error("Jumlah produk tidak valid.");
      return {
        name: String(product.name).slice(0, 120),
        description: String(product.description ?? "").slice(0, 250),
        value: Math.round(Number(product.price) * 100) / 100,
        weight: Number(product.weight_grams) * quantity,
        length: Number(product.length_cm),
        width: Number(product.width_cm),
        height: Number(product.height_cm),
        quantity,
      };
    });

    const response = await fetch("https://api.biteship.com/v1/rates/couriers", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        origin_postal_code: Number(originPostal),
        destination_postal_code: Number(destinationPostal),
        couriers: "jne,jnt",
        items,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Biteship Rates API:", response.status, payload);
      return reply(req, { error: "Penyedia ongkir belum dapat menghitung tarif. Periksa kode pos atau konfigurasi akun." }, 502);
    }
    return reply(req, { configured: true, pricing: Array.isArray(payload.pricing) ? payload.pricing : [], message: "Tarif pengiriman berhasil dimuat." });
  } catch (error) {
    console.error("shipping-rates:", error);
    return reply(req, { error: error instanceof Error ? error.message : "Gagal menghitung ongkir." }, 400);
  }
});
