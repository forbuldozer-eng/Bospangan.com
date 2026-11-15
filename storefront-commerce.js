import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const rupiah = (value) => "Rp" + Number(value || 0).toLocaleString("id-ID");
const cartStorageKey = "bp-checkout-cart-v1";
const favoritesStorageKey = "bp-checkout-favorites-v1";

const storedCart = readStorage(cartStorageKey, {});
const storedFavorites = readStorage(favoritesStorageKey, []);
const state = {
  products: [],
  cart: storedCart && typeof storedCart === "object" && !Array.isArray(storedCart) ? storedCart : {},
  favorites: Array.isArray(storedFavorites) ? storedFavorites : [],
  category: "Semua",
  query: "",
  defaultTax: 0,
  checkoutReady: false,
  idempotencyKey: null,
};

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Checkout still works for the current page if browser storage is disabled.
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function button(text, onClick, className = "") {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function setStatus(text, isError = false) {
  const status = $("status");
  status.textContent = text;
  status.style.color = isError ? "#a12626" : "";
}

function installStyles() {
  const style = el("style");
  style.textContent = [
    ".bp-product-card{display:flex;flex-direction:column;gap:7px}",
    ".bp-product-image{width:100%;height:170px;object-fit:contain;background:#f8faf5;border-radius:10px}",
    ".bp-product-placeholder{width:100%;height:170px;display:grid;place-items:center;background:#f4f6ed;border-radius:10px;color:#567263;font-weight:750;font-size:24px}",
    ".bp-product-card .bp-card-actions{display:flex;gap:7px;margin-top:auto}",
    ".bp-product-card .bp-card-actions button{flex:1}",
    ".bp-stock{font-size:12px;color:#52685b}",
    ".bp-price{font-size:18px;font-weight:800;margin:3px 0}",
    ".bp-muted{color:#596d60;font-size:13px}",
    ".bp-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:12px 0;border-bottom:1px solid #dce3d7}",
    ".bp-qty{display:flex;align-items:center;gap:7px;white-space:nowrap}",
    ".bp-summary{background:#f4f6ed;border-radius:10px;padding:12px;margin:14px 0}",
    ".bp-summary-row{display:flex;justify-content:space-between;gap:12px;margin:5px 0}",
    ".bp-summary-row.total{font-size:18px;font-weight:850;border-top:1px solid #dce3d7;padding-top:9px;margin-top:9px}",
    ".bp-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}",
    ".bp-wide{grid-column:1/-1}",
    ".bp-form-grid input,.bp-form-grid textarea,.bp-form-grid select{width:100%;max-width:100%}",
    ".bp-form-grid button{width:100%}",
    ".bp-alert{padding:11px 13px;border-radius:10px;background:#f4f6ed;margin:10px 0}",
    ".bp-success{padding:16px;border-radius:12px;background:#edf6ed;border:1px solid #c8dfc8}",
    ".bp-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}",
    ".hidden{display:none!important}",
    ".bp-modal-image{display:block;width:100%;max-height:230px;object-fit:contain;background:#f8faf5;border-radius:10px;margin-bottom:12px}",
    "@media(max-width:600px){.bp-form-grid{grid-template-columns:1fr}.bp-wide{grid-column:auto}.bp-line{grid-template-columns:1fr}.bp-product-image,.bp-product-placeholder{height:130px}}",
  ].join("\n");
  document.head.append(style);
}

function replaceOldHandlers() {
  for (const id of ["search", "searchTop", "basket", "favoriteTop", "headerSearch"]) {
    const old = $(id);
    if (!old) continue;
    const copy = old.cloneNode(true);
    old.replaceWith(copy);
  }
}

function getTaxRate(product) {
  return product.tax_percent === null || product.tax_percent === undefined
    ? state.defaultTax
    : Number(product.tax_percent);
}

function lineMath(product, quantity) {
  const subtotal = Math.round(Number(product.price) * quantity * 100) / 100;
  const rate = getTaxRate(product);
  const tax = Math.round(subtotal * rate) / 100;
  return { subtotal, rate, tax, total: subtotal + tax };
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, quantity]) => {
      const product = state.products.find((item) => item.id === id);
      return product ? { product, quantity: Number(quantity) } : null;
    })
    .filter(Boolean);
}

function cartTotals() {
  return cartEntries().reduce((totals, entry) => {
    const row = lineMath(entry.product, entry.quantity);
    totals.subtotal += row.subtotal;
    totals.tax += row.tax;
    return totals;
  }, { subtotal: 0, tax: 0 });
}

function updateCartBadge() {
  const count = Object.values(state.cart).reduce((sum, value) => sum + Number(value || 0), 0);
  const badge = $("basketCount");
  if (badge) badge.textContent = String(count);
  const favoriteCount = $("favoriteCount");
  if (favoriteCount) favoriteCount.textContent = String(state.favorites.length);
}

function imageFor(product, className) {
  const url = Array.isArray(product.image_urls) ? product.image_urls[0] : "";
  if (url) {
    try {
      const parsed = new URL(url);
      const expectedOrigin = new URL(SUPABASE_URL).origin;
      if (parsed.origin === expectedOrigin && parsed.pathname.includes("/storage/v1/object/public/product-images/")) {
        const image = el("img", className);
        image.src = parsed.href;
        image.alt = product.name;
        image.loading = "lazy";
        image.onerror = () => {
          const placeholder = el("div", "bp-product-placeholder", "Bos Pangan");
          image.replaceWith(placeholder);
        };
        return image;
      }
    } catch {
      // Render a safe placeholder for a malformed or non-project image URL.
    }
  }
  const placeholder = el("div", "bp-product-placeholder", "Bos Pangan");
  placeholder.setAttribute("role", "img");
  placeholder.setAttribute("aria-label", "Foto produk belum tersedia");
  return placeholder;
}

function renderFilters() {
  const root = $("filters");
  root.replaceChildren();
  const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))];
  const choices = ["Semua", "Favorit", ...categories];
  choices.forEach((category) => {
    root.append(button(category, () => {
      state.category = category;
      renderProducts();
    }, state.category === category ? "active" : ""));
  });
}

function renderProducts() {
  const grid = $("grid");
  grid.replaceChildren();
  const search = state.query.toLocaleLowerCase("id-ID");
  const visible = state.products.filter((product) => {
    const categoryMatch = state.category === "Semua"
      || (state.category === "Favorit" ? state.favorites.includes(product.id) : product.category === state.category);
    const text = [product.name, product.sku, product.category, product.description].join(" ").toLocaleLowerCase("id-ID");
    return categoryMatch && text.includes(search);
  });

  visible.forEach((product) => {
    const card = el("article", "card bp-product-card");
    const details = button("", () => showProduct(product));
    details.className = "art";
    details.append(imageFor(product, "bp-product-image"));
    card.append(details);
    card.append(el("small", "", product.category + " · SKU " + product.sku));
    card.append(el("h3", "", product.name));
    card.append(el("div", "bp-price", rupiah(product.price) + " / " + product.unit));
    card.append(el("p", "bp-stock", "Stok tersedia: " + Number(product.stock).toLocaleString("id-ID") + " " + product.unit));
    const taxRate = getTaxRate(product);
    card.append(el("p", "bp-muted", taxRate + "% pajak " + (product.tax_percent == null ? "(default toko)" : "(khusus produk)")));

    const actions = el("div", "bp-card-actions");
    actions.append(button("Detail", () => showProduct(product)));
    const add = button(Number(product.stock) > 0 ? "Tambah" : "Stok habis", () => addToCart(product, 1), "primary");
    add.disabled = Number(product.stock) <= 0;
    actions.append(add);
    const favorite = button(state.favorites.includes(product.id) ? "♥" : "♡", () => toggleFavorite(product.id));
    favorite.setAttribute("aria-label", "Favorit " + product.name);
    actions.append(favorite);
    card.append(actions);
    grid.append(card);
  });

  if (!visible.length) {
    grid.append(el("p", "bp-alert", state.products.length
      ? "Tidak ada produk yang sesuai dengan pencarian atau kategori."
      : "Belum ada produk yang dipublikasikan. Admin dapat menayangkan produk melalui CMS."));
  }

  $("more").hidden = true;
  const sectionTitle = document.querySelector("#katalog h2");
  if (sectionTitle) sectionTitle.textContent = "Produk tersedia untuk dipesan";
  // Keep internal CMS/catalogue diagnostics out of the customer-facing storefront.
  $("status").textContent = "";
  renderFilters();
  updateCartBadge();
}

function toggleFavorite(productId) {
  state.favorites = state.favorites.includes(productId)
    ? state.favorites.filter((id) => id !== productId)
    : [...state.favorites, productId];
  saveStorage(favoritesStorageKey, state.favorites);
  renderProducts();
}

function addToCart(product, quantity) {
  const current = Number(state.cart[product.id] || 0);
  const next = current + Number(quantity);
  if (!Number.isFinite(next) || next <= 0) return;
  if (next > Number(product.stock)) {
    setStatus("Jumlah " + product.name + " melebihi stok tersedia.", true);
    return;
  }
  state.cart[product.id] = next;
  saveStorage(cartStorageKey, state.cart);
  updateCartBadge();
  setStatus(product.name + " ditambahkan ke keranjang.");
}

function openModal(title) {
  $("heading").textContent = title;
  $("panel").replaceChildren();
  if (!$("box").open) $("box").showModal();
}

function showProduct(product) {
  openModal(product.name);
  const panel = $("panel");
  panel.append(imageFor(product, "bp-modal-image"));
  panel.append(el("p", "bp-muted", "SKU: " + product.sku + " · Kategori: " + product.category));
  panel.append(el("p", "bp-price", rupiah(product.price) + " / " + product.unit));
  panel.append(el("p", "", product.description || "Deskripsi produk belum tersedia."));
  panel.append(el("p", "bp-muted", "Stok: " + Number(product.stock).toLocaleString("id-ID") + " " + product.unit));
  panel.append(el("p", "bp-muted", "Pajak: " + getTaxRate(product) + "%"));

  const form = el("form");
  const quantityLabel = el("label", "", "Jumlah (" + product.unit + ")");
  const quantity = el("input");
  quantity.type = "number";
  quantity.min = "0.001";
  quantity.max = String(product.stock);
  quantity.step = "0.001";
  quantity.value = "1";
  quantity.required = true;
  quantityLabel.append(quantity);
  form.append(quantityLabel);
  const add = button("Tambah ke keranjang", () => {
    const amount = Number(quantity.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Masukkan jumlah yang valid.", true);
      return;
    }
    addToCart(product, amount);
    $("box").close();
    openBasket();
  }, "primary full");
  add.type = "button";
  add.disabled = Number(product.stock) <= 0;
  form.append(add);
  const special = button("Tanyakan ketersediaan / penawaran", () => {
    $("box").close();
    openCheckout("special", "Saya ingin meminta informasi atau penawaran untuk " + product.name + " (SKU " + product.sku + ").");
  }, "full");
  form.append(special);
  panel.append(form);
}

function openBasket() {
  openModal("Keranjang belanja");
  const panel = $("panel");
  const entries = cartEntries();

  if (!entries.length) {
    panel.append(el("p", "bp-alert", "Keranjang masih kosong. Pilih produk yang tersedia atau ajukan permintaan transaksi khusus."));
  }

  entries.forEach(({ product, quantity }) => {
    const row = el("div", "bp-line");
    const info = el("div");
    info.append(el("strong", "", product.name));
    info.append(el("div", "bp-muted", rupiah(product.price) + " / " + product.unit + " · Pajak " + getTaxRate(product) + "%"));
    const math = lineMath(product, quantity);
    info.append(el("div", "bp-muted", "Subtotal " + rupiah(math.subtotal) + " · Pajak " + rupiah(math.tax)));

    const controls = el("div", "bp-qty");
    const minus = button("−", () => changeQuantity(product, -1));
    minus.setAttribute("aria-label", "Kurangi " + product.name);
    const qty = el("strong", "", Number(quantity).toLocaleString("id-ID"));
    const plus = button("+", () => changeQuantity(product, 1));
    plus.setAttribute("aria-label", "Tambah " + product.name);
    const remove = button("Hapus", () => {
      delete state.cart[product.id];
      saveStorage(cartStorageKey, state.cart);
      openBasket();
      updateCartBadge();
    });
    controls.append(minus, qty, plus, remove);
    row.append(info, controls);
    panel.append(row);
  });

  if (entries.length) {
    const totals = cartTotals();
    const summary = el("div", "bp-summary");
    addSummaryRow(summary, "Subtotal", rupiah(totals.subtotal));
    addSummaryRow(summary, "Pajak", rupiah(totals.tax));
    addSummaryRow(summary, "Total perkiraan", rupiah(totals.subtotal + totals.tax), true);
    panel.append(summary);
  }

  const checkoutButton = button("Lanjut checkout", () => openCheckout("regular"), "primary full");
  checkoutButton.disabled = !entries.length || !state.checkoutReady;
  panel.append(checkoutButton);
  panel.append(button("Minta penawaran / transaksi khusus", () => openCheckout("special"), "full"));
  if (!state.checkoutReady) panel.append(el("p", "bp-muted", "Checkout sedang menunggu konfigurasi database. Silakan coba lagi setelah sistem siap."));
}

function addSummaryRow(root, label, value, total = false) {
  const row = el("div", "bp-summary-row" + (total ? " total" : ""));
  row.append(el("span", "", label), el("strong", "", value));
  root.append(row);
}

function changeQuantity(product, delta) {
  const next = Number(state.cart[product.id] || 0) + delta;
  if (next <= 0) delete state.cart[product.id];
  else if (next > Number(product.stock)) {
    setStatus("Stok " + product.name + " tidak mencukupi.", true);
    return;
  } else state.cart[product.id] = next;
  saveStorage(cartStorageKey, state.cart);
  updateCartBadge();
  openBasket();
}

function openCheckout(type = "regular", initialRequest = "") {
  if (!state.checkoutReady) {
    openModal("Checkout belum siap");
    $("panel").append(el("p", "bp-alert", "Konfigurasi checkout database belum selesai. Silakan hubungi admin."));
    return;
  }
  state.idempotencyKey = crypto.randomUUID();
  openModal(type === "special" ? "Permintaan transaksi khusus" : "Checkout pesanan");
  const panel = $("panel");
  const form = el("form", "bp-form-grid");
  form.id = "bpCheckoutForm";

  const nameLabel = el("label", "", "Nama lengkap *");
  const nameInput = el("input");
  nameInput.name = "customer_name";
  nameInput.required = true;
  nameInput.maxLength = 120;
  nameInput.autocomplete = "name";
  nameInput.placeholder = "Nama penerima";
  nameLabel.append(nameInput);

  const emailLabel = el("label", "", "Email aktif *");
  const emailInput = el("input");
  emailInput.name = "customer_email";
  emailInput.type = "email";
  emailInput.required = true;
  emailInput.maxLength = 254;
  emailInput.autocomplete = "email";
  emailInput.placeholder = "nama@email.com";
  emailLabel.append(emailInput);

  const phoneLabel = el("label", "", "Nomor WhatsApp / telepon *");
  const phoneInput = el("input");
  phoneInput.name = "customer_phone";
  phoneInput.type = "tel";
  phoneInput.required = true;
  phoneInput.maxLength = 32;
  phoneInput.autocomplete = "tel";
  phoneInput.placeholder = "08xxxxxxxxxx";
  phoneLabel.append(phoneInput);

  const addressLabel = el("label", "bp-wide", "Alamat pengiriman (wajib untuk pesanan reguler)");
  const addressInput = el("textarea");
  addressInput.name = "customer_address";
  addressInput.rows = 2;
  addressInput.maxLength = 1000;
  addressInput.autocomplete = "street-address";
  addressInput.placeholder = "Jalan, kelurahan, kecamatan, kota, kode pos";
  addressLabel.append(addressInput);

  const typeLabel = el("label", "bp-wide", "Jenis transaksi");
  const typeSelect = el("select");
  typeSelect.name = "transaction_type";
  typeSelect.id = "bpTransactionType";
  const regularOption = el("option", "", "Pesanan reguler");
  regularOption.value = "regular";
  const specialOption = el("option", "", "Permintaan transaksi khusus / penawaran");
  specialOption.value = "special";
  typeSelect.append(regularOption, specialOption);
  typeSelect.value = type;
  typeLabel.append(typeSelect);

  const requestLabel = el("label", "bp-wide", "Detail kebutuhan / permintaan khusus (wajib untuk transaksi khusus)");
  const requestInput = el("textarea");
  requestInput.name = "special_request";
  requestInput.id = "bpSpecialRequest";
  requestInput.rows = 3;
  requestInput.maxLength = 4000;
  requestInput.placeholder = "Jelaskan jenis barang, jumlah, spesifikasi, jadwal, atau kebutuhan penawaran...";
  requestInput.value = initialRequest;
  requestLabel.append(requestInput);

  const summary = el("div", "bp-summary bp-wide");
  const entries = cartEntries();
  if (entries.length) {
    summary.append(el("strong", "", "Produk yang dipilih"));
    entries.forEach(({ product, quantity }) => {
      summary.append(el("div", "bp-summary-row", product.name + " × " + Number(quantity).toLocaleString("id-ID")));
    });
    const totals = cartTotals();
    addSummaryRow(summary, "Subtotal", rupiah(totals.subtotal));
    addSummaryRow(summary, "Pajak", rupiah(totals.tax));
    addSummaryRow(summary, "Total perkiraan", rupiah(totals.subtotal + totals.tax), true);
  } else {
    summary.append(el("p", "", "Belum ada produk di keranjang. Permintaan khusus tetap dapat dikirim melalui deskripsi kebutuhan."));
  }

  const note = el("p", "bp-muted bp-wide",
    "Tidak ada pembayaran online pada tahap ini. Admin Bos Pangan akan menghubungi Anda untuk konfirmasi ketersediaan, ongkir, dan pembayaran."
  );

  const honeypot = el("label", "bp-honeypot", "Website");
  honeypot.setAttribute("aria-hidden", "true");
  const honeypotInput = el("input");
  honeypotInput.name = "company_website";
  honeypotInput.tabIndex = -1;
  honeypotInput.autocomplete = "off";
  honeypot.append(honeypotInput);

  const status = el("p", "bp-muted bp-wide");
  status.id = "bpCheckoutStatus";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const submit = el("button", "primary bp-wide", "Kirim pesanan");
  submit.type = "submit";

  form.append(nameLabel, emailLabel, phoneLabel, addressLabel, typeLabel, requestLabel, summary, note, honeypot, status, submit);
  panel.append(form);

  // Prefill customer identity when a customer is signed in. The email is kept
  // fixed so the order can be securely attached to that same customer account.
  db.auth.getSession().then(({ data }) => {
    const sessionUser = data?.session?.user;
    if (!sessionUser) return;
    nameInput.value = sessionUser.user_metadata?.display_name || nameInput.value;
    emailInput.value = sessionUser.email || "";
    emailInput.readOnly = true;
    emailInput.title = "Email mengikuti akun pelanggan yang sedang login.";
    const hint = el("small", "bp-muted", "Pesanan ini akan ditautkan ke akun pelanggan Anda.");
    emailLabel.append(hint);
  }).catch((error) => console.warn("Customer session lookup:", error));

  const updateFields = () => {
    const isRegular = typeSelect.value === "regular";
    addressInput.required = isRegular;
    requestInput.required = !isRegular;
    requestLabel.classList.toggle("hidden", isRegular);
    submit.textContent = isRegular ? "Kirim pesanan" : "Kirim permintaan khusus";
    submit.disabled = isRegular && (!cartEntries().length || !state.checkoutReady);
  };
  typeSelect.addEventListener("change", updateFields);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;

    const data = new FormData(form);
    const kind = String(data.get("transaction_type"));
    const items = cartEntries().map(({ product, quantity }) => ({
      product_id: product.id,
      quantity,
    }));

    if (kind === "regular" && !items.length) {
      status.textContent = "Keranjang pesanan masih kosong.";
      return;
    }
    if (kind === "special" && String(data.get("special_request") ?? "").trim().length < 10) {
      status.textContent = "Jelaskan kebutuhan transaksi khusus minimal 10 karakter.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Mengirim...";
    status.textContent = "Mengirim pesanan ke Bos Pangan...";
    try {
      const response = await fetch(SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/create-order", {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: data.get("customer_name"),
          customer_email: data.get("customer_email"),
          customer_phone: data.get("customer_phone"),
          customer_address: data.get("customer_address"),
          transaction_type: kind,
          special_request: data.get("special_request"),
          items,
          idempotency_key: state.idempotencyKey,
          company_website: data.get("company_website"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "Permintaan checkout gagal (" + response.status + ").");
      }
      if (!result?.success || !result?.order?.order_number) {
        throw new Error(result?.error || "Server tidak mengembalikan nomor transaksi.");
      }

      // Link the accepted order to the signed-in customer only after the
      // database verifies that the order email matches the Auth email.
      const { data: customerSession } = await db.auth.getSession();
      if (customerSession?.session?.user && result.order?.id) {
        const { error: linkError } = await db.rpc("attach_order_to_current_customer", {
          p_order_id: result.order.id,
        });
        result.customer_order_linked = !linkError;
        if (linkError) console.warn("Customer order linking:", linkError.message);
      }

      state.cart = {};
      saveStorage(cartStorageKey, state.cart);
      updateCartBadge();
      showOrderSuccess(result);
    } catch (error) {
      status.textContent = error.message || "Pesanan tidak dapat diproses. Coba kembali.";
      submit.disabled = false;
      submit.textContent = kind === "regular" ? "Kirim pesanan" : "Kirim permintaan khusus";
    }
  });

  updateFields();
}

function showOrderSuccess(result) {
  const order = result.order;
  openModal(result.order.transaction_type === "special" ? "Permintaan diterima" : "Pesanan diterima");
  const panel = $("panel");
  const success = el("div", "bp-success");
  success.append(el("h3", "", "Terima kasih. Data transaksi sudah masuk ke Bos Pangan."));
  success.append(el("p", "", "Nomor transaksi: " + order.order_number));
  success.append(el("p", "", "Status: " + (order.status === "quoted" ? "Menunggu penawaran admin" : "Menunggu konfirmasi admin")));
  success.append(el("p", "", "Subtotal: " + rupiah(order.subtotal)));
  success.append(el("p", "", "Pajak: " + rupiah(order.tax_amount)));
  success.append(el("p", "", "Total perkiraan: " + rupiah(order.total)));
  if (result.customer_order_linked === true) {
    success.append(el("p", "bp-muted", "Pesanan ini sudah ditautkan ke akun pelanggan Anda dan dapat dilihat dari menu Akun Pelanggan."));
  } else if (result.customer_order_linked === false) {
    success.append(el("p", "bp-muted", "Pesanan sudah tersimpan. Namun, pesanan belum tertaut ke riwayat akun pelanggan. Hubungi Admin Bos Pangan untuk bantuan."));
  }
  if (result.email_status === "sent") {
    success.append(el("p", "bp-muted", "Notifikasi email sudah dikirim ke tim Bos Pangan."));
  } else if (result.email_status === "pending_configuration") {
    success.append(el("p", "bp-muted", "Pesanan tersimpan. Notifikasi email owner masih menunggu konfigurasi penyedia email."));
  } else if (result.email_status === "failed") {
    success.append(el("p", "bp-muted", "Pesanan tersimpan, tetapi pengiriman email gagal. Admin dapat melihat transaksi di CMS."));
  } else if (result.email_status === "disabled") {
    success.append(el("p", "bp-muted", "Notifikasi email sedang dinonaktifkan."));
  } else {
    success.append(el("p", "bp-muted", "Pesanan tersimpan. Admin dapat melihat transaksi di CMS."));
  }
  success.append(el("p", "bp-muted", "Admin akan menghubungi Anda untuk konfirmasi akhir, biaya pengiriman, dan cara pembayaran."));
  panel.append(success);
  panel.append(button("Kembali ke katalog", () => $("box").close(), "primary full"));
}

function wireControls() {
  const search = $("search");
  const searchTop = $("searchTop");
  const basket = $("basket");
  const favorites = $("favoriteTop");
  const headerSearch = $("headerSearch");

  search.addEventListener("input", () => {
    state.query = search.value.trim();
    searchTop.value = search.value;
    renderProducts();
  });
  searchTop.addEventListener("input", () => {
    state.query = searchTop.value.trim();
    search.value = searchTop.value;
    renderProducts();
  });
  headerSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = searchTop.value.trim();
    search.value = searchTop.value;
    renderProducts();
    $("katalog").scrollIntoView({ behavior: "smooth" });
  });

  basket.addEventListener("click", openBasket);
  favorites.addEventListener("click", () => {
    state.category = "Favorit";
    $("katalog").scrollIntoView({ behavior: "smooth" });
    renderProducts();
  });
  $("more").hidden = true;
}

async function initialize() {
  installStyles();
  replaceOldHandlers();
  wireControls();
  setStatus("Memuat katalog Bos Pangan...");

  const [productsResponse, taxResponse] = await Promise.all([
    db.from("products")
      .select("id,name,sku,category,price,stock,unit,description,image_urls,tax_percent,is_featured,youtube_url")
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    db.rpc("get_public_default_tax_percent"),
  ]);

  if (productsResponse.error) {
    state.products = [];
    renderProducts();
    setStatus("Katalog belum dapat dimuat: " + productsResponse.error.message, true);
    return;
  }

  state.products = productsResponse.data ?? [];
  const validIds = new Set(state.products.map((product) => product.id));
  for (const id of Object.keys(state.cart)) {
    if (!validIds.has(id)) delete state.cart[id];
  }
  state.favorites = state.favorites.filter((id) => validIds.has(id));
  saveStorage(cartStorageKey, state.cart);
  saveStorage(favoritesStorageKey, state.favorites);

  let checkoutWarning = "";
  if (taxResponse.error || taxResponse.data === null) {
    state.checkoutReady = false;
    checkoutWarning = "Katalog dimuat, tetapi checkout belum siap. Admin perlu menjalankan supabase/checkout.sql.";
  } else {
    state.defaultTax = Number(taxResponse.data);
    state.checkoutReady = true;
  }

  renderProducts();
  if (state.checkoutReady) {
    setStatus(state.products.length + " produk tersedia. Pajak default toko " + state.defaultTax + "%.");
  } else {
    setStatus(checkoutWarning, true);
  }
}

initialize().catch((error) => {
  console.error("Bos Pangan storefront:", error);
  setStatus("Katalog tidak dapat dimuat: " + (error.message || error), true);
});
