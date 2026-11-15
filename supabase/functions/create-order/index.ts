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
    "Access-Control-Allow-Headers": "apikey, x-client-info, content-type",
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

let projectUrl = "";
let secretApiKey = "";

function databaseUrl(path: string) {
  return projectUrl.replace(/\/+$/, "") + "/rest/v1/" + path;
}

// Use the new Supabase secret key only in the apikey header. Do not send it
// as Authorization: Bearer because sb_secret_* values are not JWTs.
async function databaseRequest(path: string, options: { method?: string; body?: unknown; prefer?: string } = {}) {
  const headers: Record<string, string> = {
    apikey: secretApiKey,
    "Content-Type": "application/json",
  };
  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(databaseUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await response.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const detail = typeof data === "object" && data
      ? data.message ?? data.msg ?? data.error ?? JSON.stringify(data)
      : String(data ?? response.statusText);
    throw new Error("Database request failed (" + response.status + "): " + detail);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) {
    return json(req, { error: "Origin tidak diizinkan." }, 403);
  }

  projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
  try {
    const configuredSecretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    secretApiKey = String(configuredSecretKeys.default ?? "");
  } catch {
    secretApiKey = "";
  }

  // Backward-compatible fallback for projects still exposing the legacy key.
  if (!secretApiKey) secretApiKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!projectUrl || !secretApiKey) {
    return json(req, { error: "Kunci server Supabase belum tersedia pada Edge Function." }, 500);
  }

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

    const result = await databaseRequest("rpc/submit_storefront_order", {
      method: "POST",
      body: {
        p_customer_name: name,
        p_customer_email: email,
        p_customer_phone: phone,
        p_customer_address: address,
        p_transaction_type: kind,
        p_special_request: specialRequest,
        p_items: normalizedItems,
        p_idempotency_key: idempotencyKey,
        p_request_fingerprint: await fingerprintIp(req),
      },
    });

    const order = result?.order;
    if (!order?.id || !order?.order_number) {
      throw new Error("Database tidak mengembalikan nomor transaksi.");
    }

    let emailStatus = "not_queued";
    const queueParams = new URLSearchParams({
      select: "id,recipient_email,subject,status",
      event_type: "eq.new_order",
      status: "in.(pending,failed)",
      limit: "1",
    });
    queueParams.set("payload->>order_id", "eq." + order.id);

    const queueRows = await databaseRequest("notification_queue?" + queueParams.toString());
    const queueItem = Array.isArray(queueRows) ? queueRows[0] : null;

    if (queueItem) {
      const settingsParams = new URLSearchParams({
        select: "key,value",
        key: "in.(email_notifications_enabled)",
      });
      const settings = await databaseRequest("store_settings?" + settingsParams.toString());
      const config = Object.fromEntries((settings ?? []).map((row: any) => [row.key, row.value]));
      const emailEnabled = config.email_notifications_enabled !== false;
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const emailFrom = Deno.env.get("EMAIL_FROM");
      const queueFilter = "notification_queue?id=eq." + encodeURIComponent(queueItem.id);
      // Older settings may have been double-serialized into JSONB. Remove
      // surrounding quote characters before passing the recipient to Resend.
      const recipientEmail = String(queueItem.recipient_email ?? "")
        .trim()
        .replace(/^["']+|["']+$/g, "");

      if (!emailEnabled) {
        await databaseRequest(queueFilter, {
          method: "PATCH",
          body: { status: "failed", last_error: "Notifikasi email dinonaktifkan di pengaturan toko." },
          prefer: "return=minimal",
        });
        emailStatus = "disabled";
      } else if (!resendKey || !emailFrom) {
        emailStatus = "pending_configuration";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        await databaseRequest(queueFilter, {
          method: "PATCH",
          body: { status: "failed", last_error: "Alamat email penerima owner tidak valid." },
          prefer: "return=minimal",
        });
        emailStatus = "failed";
      } else {
        await databaseRequest(queueFilter, {
          method: "PATCH",
          body: { status: "processing" },
          prefer: "return=minimal",
        });

        const itemParams = new URLSearchParams({
          select: "sku_snapshot,product_name_snapshot,quantity,unit_price,line_subtotal,tax_percent,tax_amount",
          order_id: "eq." + order.id,
        });
        const lines = await databaseRequest("order_items?" + itemParams.toString());

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

        let providerError = "";
        let sentOk = false;
        try {
          const sent = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + resendKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [recipientEmail],
              subject: queueItem.subject,
              html,
            }),
          });
          sentOk = sent.ok;
          if (!sent.ok) providerError = (await sent.text()).slice(0, 1000);
        } catch (deliveryError) {
          providerError = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
        }

        if (sentOk) {
          await databaseRequest(queueFilter, {
            method: "PATCH",
            body: { status: "sent", sent_at: new Date().toISOString(), last_error: null },
            prefer: "return=minimal",
          });
          emailStatus = "sent";
        } else {
          await databaseRequest(queueFilter, {
            method: "PATCH",
            body: { status: "failed", last_error: providerError || "Email provider error" },
            prefer: "return=minimal",
          });
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
