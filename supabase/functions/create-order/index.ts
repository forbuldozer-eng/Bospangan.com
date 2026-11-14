import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://bospangancom-theta.vercel.app",
  "https://bospangan.com",
  "https://www.bospangan.com",
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
]);

function headersFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://bospangancom-theta.vercel.app";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headersFor(req), "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function fingerprintIp(req: Request): Promise<string | null> {
  const forwarded = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "";
  if (!forwarded) return null;

  const bytes = new TextEncoder().encode(forwarded);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: headersFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return json(req, { error: "Origin tidak diizinkan." }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL");
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) {
    try {
      const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
      serviceKey = typeof secretKeys === "string"
        ? secretKeys
        : String(secretKeys.default ?? "");
    } catch {
      serviceKey = "";
    }
  }
  if (!url || !serviceKey) {
    return json(req, { error: "Kunci server Supabase belum tersedia pada Edge Function." }, 500);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const raw = await req.text();
    if (raw.length > 32_000) return json(req, { error: "Data checkout terlalu besar." }, 413);

    const input = JSON.parse(raw);
    if (String(input.company_website ?? "").trim()) {
      return json(req, { error: "Permintaan tidak dapat diproses." }, 400);
    }

    const name = String(input.customer_name ?? "").trim().slice(0, 120);
    const email = String(input.customer_email ?? "").trim().toLowerCase().slice(0, 254);
    const phone = String(input.customer_phone ?? "").trim().slice(0, 32);
    const address = String(input.customer_address ?? "").trim().slice(0, 1000);
    const kind = input.transaction_type === "special" ? "special" : "regular";
    const specialRequest = String(input.special_request ?? "").trim().slice(0, 4000);
    const suppliedKey = String(input.idempotency_key ?? "");
    const idempotencyKey = uuidPattern.test(suppliedKey) ? suppliedKey : crypto.randomUUID();

    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length > 50) return json(req, { error: "Maksimal 50 jenis produk per transaksi." }, 400);

    const normalizedItems = items.map((item: any) => ({
      product_id: String(item.product_id ?? ""),
      quantity: Number(item.quantity),
    }));

    if (normalizedItems.some((item: any) =>
      !uuidPattern.test(item.product_id) ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000
    )) {
      return json(req, { error: "Produk atau jumlah pesanan tidak valid." }, 400);
    }

    if (kind === "regular" && normalizedItems.length < 1) {
      return json(req, { error: "Keranjang pesanan masih kosong." }, 400);
    }
    if (kind === "special" && specialRequest.length < 10) {
      return json(req, { error: "Jelaskan kebutuhan transaksi khusus minimal 10 karakter." }, 400);
    }

    const { data: result, error: orderError } = await db.rpc("submit_storefront_order", {
      p_customer_name: name,
      p_customer_email: email,
      p_customer_phone: phone,
      p_customer_address: address,
      p_transaction_type: kind,
      p_special_request: specialRequest,
      p_items: normalizedItems,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: await fingerprintIp(req),
    });

    if (orderError) throw orderError;
    const order = result?.order;
    if (!order?.id || !order?.order_number) {
      throw new Error("Database tidak mengembalikan nomor transaksi.");
    }

    let emailStatus = "not_queued";
    const { data: queueItem, error: queueReadError } = await db
      .from("notification_queue")
      .select("id,recipient_email,subject,status")
      .eq("event_type", "new_order")
      .eq("status", "pending")
      .eq("payload->>order_id", order.id)
      .maybeSingle();

    if (queueReadError) {
      console.error("Notification queue lookup failed:", queueReadError.message);
      emailStatus = "queued";
    } else if (queueItem) {
      const { data: settings } = await db.from("store_settings")
        .select("key,value")
        .in("key", ["email_notifications_enabled"]);
      const config = Object.fromEntries((settings ?? []).map((row: any) => [row.key, row.value]));
      const emailEnabled = config.email_notifications_enabled !== false;
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const emailFrom = Deno.env.get("EMAIL_FROM");

      if (!emailEnabled) {
        await db.from("notification_queue")
          .update({ status: "failed", last_error: "Notifikasi email dinonaktifkan di pengaturan toko." })
          .eq("id", queueItem.id);
        emailStatus = "disabled";
      } else if (!resendKey || !emailFrom) {
        emailStatus = "pending_configuration";
      } else {
        await db.from("notification_queue").update({ status: "processing" }).eq("id", queueItem.id);

        const { data: lines } = await db.from("order_items")
          .select("sku_snapshot,product_name_snapshot,quantity,unit_price,line_subtotal,tax_percent,tax_amount")
          .eq("order_id", order.id);

        const itemHtml = (lines ?? []).map((line: any) =>
          "<li>" + escapeHtml(line.product_name_snapshot) + " (" + escapeHtml(line.sku_snapshot) +
          ") × " + escapeHtml(line.quantity) + " — Rp" +
          Number(line.line_subtotal).toLocaleString("id-ID") + "</li>"
        ).join("");

        const html = [
          "<h2>Transaksi baru Bos Pangan</h2>",
          "<p>Nomor transaksi: <strong>" + escapeHtml(order.order_number) + "</strong></p>",
          "<p>Jenis transaksi: " + escapeHtml(kind === "special" ? "Permintaan khusus / penawaran" : "Pesanan reguler") + "</p>",
          "<p>Nama: " + escapeHtml(name) + "<br>Email: " + escapeHtml(email) +
          "<br>Telepon: " + escapeHtml(phone) + "<br>Alamat: " + escapeHtml(address || "Tidak diberikan") + "</p>",
          itemHtml ? "<h3>Daftar produk</h3><ul>" + itemHtml + "</ul>" : "",
          "<p>Subtotal: Rp" + Number(order.subtotal).toLocaleString("id-ID") +
          "<br>Pajak: Rp" + Number(order.tax_amount).toLocaleString("id-ID") +
          "<br><strong>Total: Rp" + Number(order.total).toLocaleString("id-ID") + "</strong></p>",
          "<p>Catatan: " + escapeHtml(specialRequest || "—") + "</p>",
        ].join("");

        const sent = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + resendKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [queueItem.recipient_email],
            subject: queueItem.subject,
            html,
          }),
        });

        if (sent.ok) {
          await db.from("notification_queue").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
          }).eq("id", queueItem.id);
          emailStatus = "sent";
        } else {
          const providerError = (await sent.text()).slice(0, 1000);
          await db.from("notification_queue").update({
            status: "failed",
            last_error: providerError || "Email provider error",
          }).eq("id", queueItem.id);
          console.error("Order email provider error:", providerError);
          emailStatus = "failed";
        }
      }
    }

    return json(req, {
      success: true,
      duplicate: Boolean(result?.duplicate),
      order,
      email_status: emailStatus,
      message: kind === "special"
        ? "Permintaan transaksi khusus berhasil diterima."
        : "Pesanan berhasil diterima.",
    });
  } catch (error) {
    console.error("create-order:", error);
    return json(req, {
      error: error instanceof Error ? error.message : "Pesanan tidak dapat diproses.",
    }, 400);
  }
});
