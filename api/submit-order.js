const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://uogwlzuiemxwsnpigydg.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_ORDERS_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID ||
  "";

const SB_HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Authoritative order pricing ────────────────────────────────────────────
// The storefront sends prices for UX; the server re-derives them from the
// catalog, promo codes and delivery table before anything is persisted.
function parseJsonFieldSafe(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }
  return fallback;
}

function normalizeVariantLabel(value) {
  return String(value == null ? "" : value).toLowerCase().replace(/\s+/g, "");
}

function variantLabel(v, index) {
  if (v && typeof v === "object") {
    if (v.weight) return `${v.weight}${v.unit || ""}`;
    if (v.label) return String(v.label);
    if (v.name) return String(v.name);
  }
  if (v !== undefined && v !== null) return String(v);
  return `Option ${index + 1}`;
}

function findPricedVariant(product, item) {
  const variants = parseJsonFieldSafe(product && product.variants, []);
  if (!Array.isArray(variants) || variants.length === 0) return null;
  // Cached bundles may send a SKU instead of a product id; the SKU identifies
  // the priced variant directly.
  const wantedSku = String((item && (item.sku || item.productId || item.product_id)) || "").trim().toLowerCase();
  if (wantedSku) {
    const bySku = variants.find((v) => {
      if (!v || typeof v !== "object") return false;
      return [v.sku, ...Object.values(v.flavorSkus || {})]
        .some((s) => String(s || "").trim().toLowerCase() === wantedSku);
    });
    if (bySku !== undefined) return bySku;
  }
  const wanted = normalizeVariantLabel(item && item.variant);
  if (wanted) {
    const byLabel = variants.find((v) => normalizeVariantLabel(variantLabel(v, 0)) === wanted);
    if (byLabel !== undefined) return byLabel;
    const byWeight = variants.find((v) => v && typeof v === "object" && normalizeVariantLabel(v.weight) === wanted);
    if (byWeight !== undefined) return byWeight;
  }
  return variants[0];
}

function authoritativeUnitPrice(product, item) {
  const variant = findPricedVariant(product, item);
  const base = Number(variant && typeof variant === "object" && variant.price) || Number(product.price) || 0;
  const disc = Number(product.discount) || 0;
  if (disc <= 0) return base;
  return disc <= 100
    ? Math.max(0, Math.round(base * (1 - disc / 100)))
    : Math.max(0, Math.round(base - disc));
}

function isStorewidePromo(promo) {
  const value = promo.apply_to_all !== undefined ? promo.apply_to_all : promo.applyToAll;
  return value === true || String(value).toUpperCase() === "TRUE";
}

function productAcceptsPromo(product, promo) {
  if (!product) return false;
  const allow = product.allow_promo !== undefined ? product.allow_promo : product.allowPromo;
  if (!(allow === true || String(allow).toUpperCase() === "TRUE")) return false;
  const rawIds = product.promo_code_ids !== undefined ? product.promo_code_ids : product.promoCodeIds;
  let ids = rawIds;
  if (typeof rawIds === "string" && rawIds.trim()) {
    ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(ids)) ids = [];
  if (ids.length === 0) return true;
  return ids.some((id) => String(id) === String(promo.id));
}

function promoEligibleSubtotal(lines, promo) {
  const full = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  if (!promo) return 0;
  if (isStorewidePromo(promo)) return full;
  const eligible = lines.filter((l) => productAcceptsPromo(l.product, promo));
  if (promo.type === "free_delivery") return eligible.length > 0 ? full : 0;
  return eligible.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

function promoStillValid(promo, subtotal) {
  if (String(promo.status || "active").toLowerCase() !== "active") return false;
  const minOrder = Number(promo.min_order !== undefined ? promo.min_order : promo.minOrder) || 0;
  if (minOrder > 0 && subtotal < minOrder) return false;
  if (promo.expiry) {
    const exp = new Date(promo.expiry);
    if (!Number.isNaN(exp.getTime())) {
      exp.setHours(23, 59, 59, 999);
      if (exp.getTime() < Date.now()) return false;
    }
  }
  if (promo.maxUses && Number(promo.uses) >= Number(promo.maxUses)) return false;
  return true;
}

function findDeliveryRow(rows, wilaya) {
  if (!Array.isArray(rows)) return null;
  const targetDigits = String(wilaya || "").match(/\b\d+\b/);
  const targetNum = targetDigits ? parseInt(targetDigits[0], 10) : NaN;
  const targetRaw = String(wilaya || "").trim().toLowerCase();
  const targetNorm = targetRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return rows.find((row) => {
    if (!row || !row.wilaya) return false;
    const raw = String(row.wilaya).trim().toLowerCase();
    const norm = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const digits = raw.match(/\b\d+\b/);
    if (digits && !Number.isNaN(targetNum) && parseInt(digits[0], 10) === targetNum) return true;
    if (norm === targetNorm || norm === targetRaw || raw === targetRaw) return true;
    if (targetNorm && (norm.includes(targetNorm) || targetNorm.includes(norm))) return true;
    return false;
  }) || null;
}

async function computeAuthoritativeOrder({ items, promoCode, deliveryType, wilaya }) {
  const rawItems = Array.isArray(items) ? items : [];
  const normalized = rawItems.map((it) => (it && typeof it === "object" ? { ...it } : {}));
  const productIds = [...new Set(normalized
    .filter((it) => !it.isGift)
    .map((it) => String(it.productId || it.product_id || "").trim())
    .filter(Boolean))];

  let catalog = [];
  if (productIds.length > 0) {
    const select = "id,variants,discount,allow_promo,promo_code_ids,status,hidden,bundle_items";
    const fetchCatalog = async (url, label) => {
      const res = await fetch(url, { headers: SB_HEADERS });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = body && (body.message || body.error || body.details) ? (body.message || body.error || body.details) : `HTTP ${res.status}`;
        console.error(`[submit-order] ${label} failed:`, msg);
        throw new Error("Unable to verify catalog prices. Please try again.");
      }
      return Array.isArray(body) ? body : [];
    };

    catalog = await fetchCatalog(
      `${SUPABASE_URL}/rest/v1/products?id=in.(${productIds.map(encodeURIComponent).join(",")})&select=${select}&limit=500`,
      "catalog lookup"
    );

    // Cached storefront bundles may still reference a variant SKU instead of a
    // product id. Resolve those against a lean full catalog before giving up.
    const found = new Set(catalog.map((p) => String(p.id)));
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      const all = await fetchCatalog(
        `${SUPABASE_URL}/rest/v1/products?select=${select}&limit=1000`,
        "catalog fallback lookup"
      );
      if (Array.isArray(all)) {
        const extra = all.filter((p) => {
          if (missing.includes(String(p.id))) return true;
          const variants = parseJsonFieldSafe(p.variants, []);
          return Array.isArray(variants) && variants.some((v) => {
            if (!v || typeof v !== "object") return false;
            const skus = [v.sku, ...Object.values(v.flavorSkus || {})].map((s) => String(s || ""));
            return skus.some((s) => missing.includes(s));
          });
        });
        catalog = catalog.concat(extra);
      }
    }
  }

  const byId = new Map();
  catalog.forEach((p) => byId.set(String(p.id), p));
  // Cached bundles can put a variant SKU in `productId`; index those too.
  catalog.forEach((p) => {
    const variants = parseJsonFieldSafe(p.variants, []);
    if (!Array.isArray(variants)) return;
    variants.forEach((v) => {
      if (!v || typeof v !== "object") return;
      [v.sku, ...Object.values(v.flavorSkus || {})].forEach((sku) => {
        const key = String(sku || "").trim();
        if (key && !byId.has(key)) byId.set(key, p);
      });
    });
  });
  const pricedLines = [];

  for (const it of normalized) {
    if (it.isGift) {
      it.qty = 1;
      it.unitPrice = 0;
      it.unit_price = 0;
      it.lineTotal = 0;
      continue;
    }
    const pid = String(it.productId || it.product_id || "").trim();
    const product = byId.get(pid) || null;
    if (!product || product.hidden === true || String(product.hidden).toLowerCase() === "true" || String(product.status || "").toLowerCase() === "inactive") {
      const err = new Error("An item in your cart is no longer available. Please refresh and try again.");
      err.status = 400;
      throw err;
    }
    const qty = Math.max(1, Math.min(99, Math.floor(Number(it.qty) || 1)));
    const unitPrice = authoritativeUnitPrice(product, it);
    it.qty = qty;
    it.unitPrice = unitPrice;
    it.unit_price = unitPrice;
    it.lineTotal = unitPrice * qty;
    pricedLines.push({ product, unitPrice, qty });
  }

  const subtotal = pricedLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const codes = String(promoCode || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const validatedPromos = [];
  for (const code of codes) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=ilike.${encodeURIComponent(code)}&limit=1`, { headers: SB_HEADERS });
    const rows = await res.json().catch(() => []);
    const promo = Array.isArray(rows) ? rows[0] : null;
    if (!promo || !promoStillValid(promo, subtotal)) {
      const err = new Error(`Promo code "${code}" is no longer valid.`);
      err.status = 400;
      throw err;
    }
    validatedPromos.push(promo);
  }

  let promoDiscount = 0;
  let promoFreeDelivery = false;
  for (const promo of validatedPromos) {
    if (promo.type === "free_delivery") {
      promoFreeDelivery = true;
      continue;
    }
    const eligible = promoEligibleSubtotal(pricedLines, promo);
    if (promo.type === "percent") promoDiscount += Math.round(eligible * (Number(promo.value) || 0) / 100);
    else if (promo.type === "fixed") promoDiscount += Math.min(Number(promo.value) || 0, eligible);
  }
  promoDiscount = Math.max(0, Math.min(promoDiscount, subtotal));

  let deliveryCost = 0;
  const deliveryRes = await fetch(`${SUPABASE_URL}/rest/v1/delivery_prices?select=*&limit=500`, { headers: SB_HEADERS });
  if (!deliveryRes.ok) throw new Error("Unable to verify delivery cost. Please try again.");
  const deliveryRows = await deliveryRes.json().catch(() => []);
  const deliveryRow = findDeliveryRow(deliveryRows, wilaya);
  if (deliveryRow) {
    const office = String(deliveryType || "").toLowerCase() === "office";
    const value = office
      ? (deliveryRow.office_price !== undefined ? deliveryRow.office_price : deliveryRow.officePrice)
      : (deliveryRow.home_price !== undefined ? deliveryRow.home_price : deliveryRow.homePrice);
    deliveryCost = Math.max(0, Number(value) || 0);
  }
  if (promoFreeDelivery || subtotal >= 15000) deliveryCost = 0;

  return {
    items: normalized,
    subtotal,
    deliveryCost,
    promoDiscount,
    total: Math.max(0, subtotal + deliveryCost - promoDiscount),
    promoCodes: validatedPromos.map((p) => String(p.code || "").trim().toUpperCase()).filter(Boolean),
    validatedPromos,
  };
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (_) {}
}

// Maximum nesting depth for composite bundle packs (a bundle inside a bundle).
const MAX_BUNDLE_DEPTH = 5;

// Normalises the `bundle_items` jsonb column into a list of component objects.
function parseBundleItems(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === "object");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === "object") : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

async function adjustStock(items, direction) {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  // Any string collected here means stock was (at least partially) NOT adjusted;
  // the caller logs it and flags the Telegram alert.
  const issues = [];

  // fetch() helper that surfaces HTTP errors (PostgREST 4xx/5xx) instead of
  // silently returning an error object that looks like empty data.
  async function fetchJson(url, label) {
    const res = await fetch(url, { headers: SB_HEADERS });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body && (body.message || body.error)) || res.statusText || "unknown";
      throw new Error(`${label} failed: HTTP ${res.status} — ${msg}`);
    }
    return body;
  }

  // Pre-fetch all inventory items AND products once so every per-item lookup is purely in-memory
  let allInvItems = [];
  let allProds = [];
  try {
    const [invAllRows, prodAllRows] = await Promise.all([
      fetchJson(`${SUPABASE_URL}/rest/v1/inventory_items?select=*`, "inventory_items prefetch").catch((e) => {
        console.error(`[adjustStock] ${e.message}`);
        issues.push(`inventory_items prefetch failed (${e.message})`);
        return [];
      }),
      // Lean catalog (no heavy text columns). If the column list is rejected by
      // PostgREST (e.g. schema drift), retry once with select=* before giving up.
      fetchJson(`${SUPABASE_URL}/rest/v1/products?select=id,name,variants,stock,bundle_items`, "products prefetch")
        .catch(() => fetchJson(`${SUPABASE_URL}/rest/v1/products?select=*`, "products prefetch (fallback)"))
        .catch((e) => {
          console.error(`[adjustStock] ${e.message}`);
          issues.push(`products prefetch failed (${e.message})`);
          return [];
        }),
    ]);
    if (Array.isArray(invAllRows)) allInvItems = invAllRows;
    if (Array.isArray(prodAllRows)) allProds = prodAllRows;
  } catch (e) {
    console.error(`[adjustStock] prefetch threw: ${e.message}`);
    issues.push(`prefetch threw (${e.message})`);
  }

  // ── In-memory stock ledger ───────────────────────────────────────────────
  // Every read comes from these maps and every write updates them, so two order
  // lines touching the same SKU accumulate instead of overwriting each other.
  const invRows = new Map();   // lowercase inventory id -> row
  const invStock = new Map();  // lowercase inventory id -> current stock
  allInvItems.forEach((i) => {
    const key = String(i.id || "").trim().toLowerCase();
    if (!key) return;
    invRows.set(key, i);
    invStock.set(key, Number(i.stock) || 0);
  });

  const prodState = new Map(); // product id -> mutable catalog snapshot
  allProds.forEach((p) => {
    prodState.set(String(p.id), {
      id: p.id,
      name: p.name || "",
      stock: Number(p.stock) || 0,
      variants: Array.isArray(p.variants) ? JSON.parse(JSON.stringify(p.variants)) : [],
      bundleItems: parseBundleItems(p.bundle_items),
    });
  });

  // Optimistic-concurrency stock update: the PATCH carries the stock value we
  // read, so a concurrent order cannot silently overwrite it. A conflict is
  // retried with a fresh read instead of using the stale snapshot.
  async function adjustInvStock(invRow, qty, label) {
    const key = String(invRow.id || "").trim().toLowerCase();
    let expected = invStock.has(key) ? invStock.get(key) : (Number(invRow.stock) || 0);
    const delta = direction * qty;
    for (let attempt = 0; attempt < 3; attempt++) {
      const next = Math.max(0, expected + delta);
      const url = `${SUPABASE_URL}/rest/v1/inventory_items?id=eq.${encodeURIComponent(invRow.id)}&stock=eq.${encodeURIComponent(expected)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { ...SB_HEADERS, Prefer: "return=representation" },
        body: JSON.stringify({ stock: next }),
      });
      const patched = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (patched && (patched.message || patched.error)) || res.statusText || "unknown";
        throw new Error(`${label} PATCH HTTP ${res.status} — ${msg}`);
      }
      if (Array.isArray(patched) && patched.length > 0) {
        const finalStock = Number(patched[0].stock) || 0;
        invStock.set(key, finalStock);
        invRow.stock = finalStock;
        return finalStock;
      }
      // Zero rows means another writer changed stock after our read.
      const freshRes = await fetch(`${SUPABASE_URL}/rest/v1/inventory_items?id=eq.${encodeURIComponent(invRow.id)}&select=stock&limit=1`, { headers: SB_HEADERS });
      const fresh = await freshRes.json().catch(() => []);
      if (!freshRes.ok || !Array.isArray(fresh) || fresh.length === 0) {
        throw new Error(`${label} stock changed concurrently and could not be re-read`);
      }
      expected = Number(fresh[0].stock) || 0;
    }
    throw new Error(`${label} stock changed concurrently after 3 attempts`);
  }

  async function patchInvStock(invRow, qty) {
    return adjustInvStock(invRow, qty, `inventory_items "${invRow.id}"`);
  }

  // Helper: find an inventory row by explicit SKU id (case-insensitive).
  // The canonical SKU lives in `id`; the optional `sku` column is a fallback.
  function findInvRow(sku) {
    if (!sku) return null;
    const s = String(sku).trim().toLowerCase();
    if (invRows.has(s)) return invRows.get(s);
    for (const row of invRows.values()) {
      if (String(row.sku || "").trim().toLowerCase() === s) return row;
    }
    return null;
  }

  // Product writes are conditional on the stock value we read. If another
  // writer changed it first, fail with an issue instead of overwriting it.
  async function patchProduct(prodId, body, expectedStock, label) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(prodId)}&stock=eq.${encodeURIComponent(expectedStock)}`, {
      method: "PATCH",
      headers: { ...SB_HEADERS, Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    const patched = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (patched && (patched.message || patched.error)) || res.statusText || "unknown";
      throw new Error(`${label} PATCH HTTP ${res.status} — ${msg}`);
    }
    if (!Array.isArray(patched) || patched.length === 0) {
      throw new Error(`${label} stock changed concurrently; not overwriting`);
    }
    return patched[0];
  }

  // Helper: find the catalog product that owns a given SKU (product id, variant
  // sku or variant flavour sku). Used to resolve bundle components.
  function findProductBySku(sku) {
    if (!sku) return null;
    const s = String(sku).trim().toLowerCase();
    for (const st of prodState.values()) {
      if (String(st.id).trim().toLowerCase() === s) return st;
      for (const v of st.variants) {
        if (!v || typeof v !== "object") continue;
        if (v.sku && String(v.sku).trim().toLowerCase() === s) return st;
        if (v.flavorSkus && Object.values(v.flavorSkus).some((x) => String(x || "").trim().toLowerCase() === s)) return st;
      }
    }
    return null;
  }

  // Helper: find an inventory row by product name + optional flavor/variant_spec
  // Used as a fallback when no explicit SKU link exists on the product variant.
  function findInvByName(itemName, flavor, variantSpec) {
    if (!itemName) return null;
    const nameLower = String(itemName).trim().toLowerCase();
    const flavorLower = flavor ? String(flavor).trim().toLowerCase() : "";
    const varLower = variantSpec ? String(variantSpec).trim().toLowerCase() : "";

    // 1. Exact name + flavor match
    if (flavorLower) {
      const hit = allInvItems.find(i =>
        String(i.name || "").trim().toLowerCase() === nameLower &&
        String(i.variant_spec || "").trim().toLowerCase() === flavorLower
      );
      if (hit) return hit;
    }

    // 2. Exact name + variant_spec match
    if (varLower) {
      const hit = allInvItems.find(i =>
        String(i.name || "").trim().toLowerCase() === nameLower &&
        String(i.variant_spec || "").trim().toLowerCase() === varLower
      );
      if (hit) return hit;
    }

    // 3. Exact name only (works for single-SKU products)
    const hit = allInvItems.find(i =>
      String(i.name || "").trim().toLowerCase() === nameLower
    );
    return hit || null;
  }

  // Pick the variant a sold line / bundle component refers to.
  // preferSku = true is used for bundle components, whose SKU is authoritative.
  function pickVariantIndex(st, { variant, flavor, sku }, preferSku) {
    const variants = (st && st.variants) || [];
    if (!variants.length) return -1;

    const wantSku = String(sku || "").trim().toLowerCase();
    const wantFlavor = String(flavor || "").trim().toLowerCase();
    const cleanVar = String(variant || "").trim().toLowerCase().split("/")[0].replace(/\s+/g, "");

    if (preferSku && wantSku) {
      const bySku = variants.findIndex((v) =>
        v && typeof v === "object" && v.sku && String(v.sku).trim().toLowerCase() === wantSku
      );
      if (bySku >= 0) return bySku;
      const byFlavorSku = variants.findIndex((v) =>
        v && typeof v === "object" && v.flavorSkus &&
        Object.values(v.flavorSkus).some((x) => String(x || "").trim().toLowerCase() === wantSku)
      );
      if (byFlavorSku >= 0) return byFlavorSku;
    }

    if (cleanVar) {
      const byLabel = variants.findIndex((v) => {
        if (!v || typeof v !== "object") return String(v).toLowerCase().replace(/\s+/g, "") === cleanVar;
        const vWeight = String(v.weight || "").toLowerCase().replace(/\s+/g, "");
        const vUnit = String(v.unit || "").toLowerCase().replace(/\s+/g, "");
        const vCombo = (vWeight + vUnit);
        const vLabel = String(v.label || v.name || "").toLowerCase().replace(/\s+/g, "");
        return vCombo === cleanVar || vWeight === cleanVar || vLabel === cleanVar || cleanVar.includes(vWeight);
      });
      if (byLabel >= 0) return byLabel;
    }

    if (wantFlavor) {
      const byFlavor = variants.findIndex((v) =>
        v && typeof v === "object" && v.flavorStock &&
        Object.keys(v.flavorStock).some((k) => k.trim().toLowerCase() === wantFlavor)
      );
      if (byFlavor >= 0) return byFlavor;
    }

    return 0;
  }

  // Deduct a catalogue product's variant / flavour stock and its global stock.
  async function deductCatalogStock(st, { qty, variant, flavor, sku }) {
    const variants = st.variants || [];
    const expectedStock = Number(st.stock) || 0;

    // Product without variants (simple product): only the global stock moves.
    if (!variants.length) {
      const newStock = Math.max(0, expectedStock + direction * qty);
      st.stock = newStock;
      try {
        await patchProduct(st.id, { stock: newStock }, expectedStock, `product "${st.name}"`);
      } catch (e) {
        console.error(`[adjustStock] ${e.message}`);
        issues.push(`product "${st.name}": ${e.message}`);
      }
      return;
    }

    const idx = pickVariantIndex(st, { variant, flavor, sku }, true);
    const v = variants[idx] || variants[0];
    if (!v) return;

    let matchedFlavorKey = "";
    const rawFlavor = String(flavor || "").trim();
    if (rawFlavor && v.flavorStock) {
      matchedFlavorKey = Object.keys(v.flavorStock).find((k) => k.trim().toLowerCase() === rawFlavor.toLowerCase()) || "";
    }
    if (!matchedFlavorKey && v.flavorStock && Object.keys(v.flavorStock).length === 1) {
      matchedFlavorKey = Object.keys(v.flavorStock)[0];
    }

    if (matchedFlavorKey && v.flavorStock) {
      v.flavorStock[matchedFlavorKey] = Math.max(0, (Number(v.flavorStock[matchedFlavorKey]) || 0) + direction * qty);
      v.stock = Object.values(v.flavorStock).reduce((s, q) => s + Number(q), 0);
    } else {
      v.stock = Math.max(0, (Number(v.stock) || 0) + direction * qty);
    }

    const newGlobal = Math.max(0, expectedStock + direction * qty);
    st.stock = newGlobal;
    try {
      await patchProduct(st.id, { variants, stock: newGlobal }, expectedStock, `product "${st.name}"`);
    } catch (e) {
      console.error(`[adjustStock] ${e.message}`);
      issues.push(`product "${st.name}": ${e.message}`);
    }
  }

  // ── Composite bundle pack ────────────────────────────────────────────────
  // A bundle is not stocked itself: it is stocked by its components. Selling one
  // pack deducts `component.qty` of every component SKU, and the bundle's own
  // stock is re-derived as the scarcest component allows.
  async function adjustBundle(st, bItems, qty, depth) {
    const realProdId = st.id;
    // For nested bundles this is the stock left by the component write above;
    // the next PATCH must be conditional on that exact value.
    const expectedStock = Number(st.stock) || 0;
    let minStock = Infinity;

    for (const bItem of bItems) {
      const bQty = Number(bItem.qty) || 1;
      const componentQty = bQty * qty;
      const bSku = String(bItem.sku || "").trim();
      const bProductId = String(bItem.productId || "").trim();
      const bFlavor = String(bItem.flavor || "").trim();
      const bVariant = String(bItem.variant || "").trim();

      // The SKU is authoritative; the product id is only a fallback.
      const targets = [];
      if (bSku) targets.push(bSku);
      if (bProductId && bProductId.toLowerCase() !== bSku.toLowerCase()) targets.push(bProductId);

      let invRow = null;
      let compState = null;
      for (const t of targets) {
        if (!invRow) invRow = findInvRow(t);
        if (!compState) compState = findProductBySku(t);
        if (invRow && compState) break;
      }

      // 1. inventory_items — the source of truth for what can still be sold.
      if (invRow) {
        try {
          await patchInvStock(invRow, componentQty);
        } catch (e) {
          console.error(`[adjustStock] ${e.message}`);
          issues.push(`bundle "${st.name}" inventory "${invRow.id}": ${e.message}`);
        }
      }

      // 2. catalog product — keep the variant / flavour stock in sync.
      if (compState) {
        await deductCatalogStock(compState, {
          qty: componentQty,
          variant: bVariant,
          flavor: bFlavor,
          sku: bSku,
        });

        // Nested bundle (a bundle containing another bundle).
        if (compState.bundleItems.length > 0) {
          await adjustBundle(compState, compState.bundleItems, componentQty, depth + 1);
        }
      }

      if (!invRow && !compState) {
        issues.push(
          `bundle "${st.name}" component "${bSku || bProductId}" (qty ${componentQty}) not found in inventory_items or products — stock NOT adjusted`
        );
        minStock = 0;
        continue;
      }

      if (!invRow) {
        issues.push(
          `bundle "${st.name}" component "${bSku || bProductId}" has no inventory_items row — link it to a SKU so the bundle stock stays accurate`
        );
        minStock = 0;
        continue;
      }

      const compStock = invStock.get(String(invRow.id).trim().toLowerCase()) || 0;
      const avail = Math.floor(compStock / bQty);
      if (avail < minStock) minStock = avail;
    }

    // The bundle can be sold as many times as its scarcest component allows
    // (same formula the admin panel uses to derive bundle stock).
    if (minStock === Infinity) {
      minStock = Math.max(0, expectedStock + direction * qty);
    }
    const finalStock = Math.max(0, minStock);

    const variants = Array.isArray(st.variants) ? st.variants : [];
    if (variants.length > 0) {
      variants[0] = { ...variants[0], stock: finalStock };
    }
    st.stock = finalStock;
    try {
      await patchProduct(realProdId, variants.length > 0 ? { variants, stock: finalStock } : { stock: finalStock }, expectedStock, `bundle "${st.name}"`);
    } catch (e) {
      console.error(`[adjustStock] ${e.message}`);
      issues.push(`bundle "${st.name}": ${e.message}`);
    }
  }

  // Adjust a single order line (recurses into composite bundle packs).
  async function adjustItem(item, depth) {
    const prodId = item.productId || item.product_id;
    if (!prodId) return;
    const qty = Number(item.qty) || 1;
    const rawVariant = String(item.variant || "").trim().toLowerCase();
    const rawFlavor = String(item.flavor || "").trim();

    // 1. Try finding the product in our in-memory catalog (by id, then by SKU)
    let st = prodState.get(String(prodId));
    if (!st) st = findProductBySku(prodId);

    if (!st) {
      // prodId itself may be a direct inventory SKU (no catalog product)
      const directInv = findInvRow(prodId);
      if (directInv) {
        try {
          await patchInvStock(directInv, qty);
        } catch (e) {
          console.error(`[adjustStock] ${e.message}`);
          issues.push(`direct SKU "${prodId}": ${e.message}`);
        }
      } else {
        const warn = `No product or inventory SKU found for productId="${prodId}" (name="${item.name}") — stock NOT adjusted`;
        console.warn(`[adjustStock] ${warn}`);
        issues.push(warn);
      }
      return;
    }

    // 2. Composite bundle pack → unpack it and adjust every component.
    if (st.bundleItems.length > 0) {
      if (depth >= MAX_BUNDLE_DEPTH) {
        issues.push(`Bundle "${st.name}" nests deeper than ${MAX_BUNDLE_DEPTH} levels — stock NOT adjusted`);
        return;
      }
      await adjustBundle(st, st.bundleItems, qty, depth);
      return;
    }

    // 3. Regular product line.
    const realProdId = st.id;
    const expectedStock = Number(st.stock) || 0;
    const variants = st.variants || [];
    const matchedIdx = pickVariantIndex(st, { variant: rawVariant, flavor: rawFlavor, sku: "" }, false);

    let linkedSku = "";
    let matchedFlavorKey = "";

    if (matchedIdx >= 0 && variants[matchedIdx]) {
      const v = variants[matchedIdx];
      if (rawFlavor && v.flavorStock) {
        matchedFlavorKey = Object.keys(v.flavorStock).find((k) => k.trim().toLowerCase() === rawFlavor.toLowerCase()) || "";
      }
      if (!matchedFlavorKey && v.flavorStock && Object.keys(v.flavorStock).length === 1) {
        matchedFlavorKey = Object.keys(v.flavorStock)[0];
      }

      if (matchedFlavorKey && v.flavorStock) {
        v.flavorStock[matchedFlavorKey] = Math.max(0, (Number(v.flavorStock[matchedFlavorKey]) || 0) + direction * qty);
        v.stock = Object.values(v.flavorStock).reduce((s, q) => s + Number(q), 0);
      } else {
        v.stock = Math.max(0, (Number(v.stock) || 0) + direction * qty);
      }

      if (matchedFlavorKey && v.flavorSkus) {
        linkedSku = v.flavorSkus[matchedFlavorKey] || "";
      }
      if (!linkedSku && v.flavorSkus && rawFlavor) {
        const fk = Object.keys(v.flavorSkus).find((k) => k.trim().toLowerCase() === rawFlavor.toLowerCase());
        if (fk) linkedSku = v.flavorSkus[fk] || "";
      }
      if (!linkedSku && v.sku) linkedSku = v.sku;

      const newGlobal = Math.max(0, expectedStock + direction * qty);
      st.stock = newGlobal;
      try {
        await patchProduct(realProdId, { variants, stock: newGlobal }, expectedStock, `product "${item.name}"`);
      } catch (e) {
        console.error(`[adjustStock] ${e.message}`);
        issues.push(`product "${item.name}": ${e.message}`);
      }
    } else {
      const newStock = Math.max(0, expectedStock + direction * qty);
      st.stock = newStock;
      try {
        await patchProduct(realProdId, { stock: newStock }, expectedStock, `product "${item.name}"`);
      } catch (e) {
        console.error(`[adjustStock] ${e.message}`);
        issues.push(`product "${item.name}": ${e.message}`);
      }
    }

    // ── Inventory deduction ──────────────────────────────────────────────────
    // Primary: explicit SKU link from v.flavorSkus or v.sku
    const explicitInv = findInvRow(linkedSku);
    if (explicitInv) {
      try {
        await patchInvStock(explicitInv, qty);
      } catch (e) {
        console.error(`[adjustStock] ${e.message}`);
        issues.push(`inventory "${item.name}": ${e.message}`);
      }
    } else {
      // Fallback: match inventory row by product name + flavor/variant_spec.
      // This covers products where SKU links were never set in the product editor.
      const fallbackInv = findInvByName(item.name, rawFlavor, rawVariant);
      if (fallbackInv) {
        console.warn(
          `[adjustStock] No explicit SKU link for "${item.name}" (flavor="${rawFlavor}", variant="${rawVariant}"). ` +
          `Used name-match fallback → inventory id="${fallbackInv.id}". ` +
          `Link this product's variant to inventory SKU "${fallbackInv.id}" in the admin panel to silence this warning.`
        );
        try {
          await patchInvStock(fallbackInv, qty);
        } catch (e) {
          console.error(`[adjustStock] ${e.message}`);
          issues.push(`inventory "${item.name}": ${e.message}`);
        }
      } else {
        const warn =
          `No inventory row found for "${item.name}" (flavor="${rawFlavor}", variant="${rawVariant}", prodId="${prodId}"). ` +
          `Inventory stock was NOT decremented. Link this product variant to an inventory SKU in the admin panel.`;
        console.warn(`[adjustStock] ${warn}`);
        issues.push(warn);
      }
    }
  }

  for (const item of items) {
    await adjustItem(item, 0);
  }

  return issues;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const {
      action, fullName, firstName, lastName, phone, address, wilaya, commune,
      deliveryType, promoCode: submittedPromoCode,
    } = body;

    // Never trust client prices/discounts/fees. Re-derive every monetary value
    // from Supabase before validation, persistence, stock changes or Telegram.
    const authoritative = await computeAuthoritativeOrder({
      items: body.items,
      promoCode: submittedPromoCode,
      deliveryType,
      wilaya,
    });
    const items = authoritative.items;
    const subtotal = authoritative.subtotal;
    const deliveryCost = authoritative.deliveryCost;
    const promoDiscount = authoritative.promoDiscount;
    const total = authoritative.total;
    const promoCode = authoritative.promoCodes.join(",");

    const id = Date.now().toString();
    const source = action === "submitCartOrder" ? "checkout" : "product-detail";
    // Storefront now sends one fullName; fall back to the old two-field shape for
    // cached bundles that are still live (assets are cached for up to a year).
    const customerName = String(fullName || `${firstName || ""} ${lastName || ""}`)
      .replace(/\s+/g, " ").trim().slice(0, 100);

    // 0. Server-side validation for free gift (authoritative — never trusts client state)
    const giftItems = (items || []).filter(it => it.isGift);
    if (giftItems.length > 0) {
      try {
        const gcRes = await fetch(`${SUPABASE_URL}/rest/v1/gift_config?select=*&limit=1`, { headers: SB_HEADERS });
        const gcRows = await gcRes.json().catch(() => ([]));
        const gc = gcRows[0] || {};

        if (!gc.enabled) {
          return res.status(400).json({ success: false, error: "Gift conditions not met." });
        }

        // Authoritative subtotal (gift lines are free and carry qty 1).
        const realSubtotal = subtotal;

        let reqProducts = [];
        if (Array.isArray(gc.required_products)) reqProducts = gc.required_products.map(String);
        else if (typeof gc.required_products === "string" && gc.required_products.trim()) {
          try {
            const parsed = JSON.parse(gc.required_products);
            if (Array.isArray(parsed)) reqProducts = parsed.map(String);
          } catch (_) {
            reqProducts = gc.required_products.split(",").map(s => s.trim()).filter(Boolean);
          }
        }

        const conditionType = gc.condition_type || 'amount';
        const hasAmount = Number(realSubtotal) >= Number(gc.threshold);
        const hasProducts = reqProducts.length > 0 && reqProducts.every(reqId =>
          (items || []).some(item => !item.isGift && String(item.productId || item.product_id) === String(reqId))
        );

        let isUnlocked = false;
        if (conditionType === 'amount') isUnlocked = hasAmount;
        else if (conditionType === 'products') isUnlocked = hasProducts;
        else if (conditionType === 'both') isUnlocked = hasAmount || hasProducts;

        // Gift line must exactly match the configured offer: one line, qty 1, correct product & flavor
        const giftMatches =
          !!gc.product_id &&
          giftItems.length === 1 &&
          Number(giftItems[0].qty) === 1 &&
          String(giftItems[0].productId || giftItems[0].product_id) === String(gc.product_id) &&
          (!gc.flavor || String(giftItems[0].flavor || "") === String(gc.flavor));

        if (!isUnlocked || !giftMatches) {
          return res.status(400).json({ success: false, error: "Gift conditions not met." });
        }

        // Normalize the stored gift line
        giftItems[0].qty = 1;
        giftItems[0].unitPrice = 0;
        giftItems[0].unit_price = 0;
      } catch (e) {
        return res.status(400).json({ success: false, error: "Gift conditions not met." });
      }
    }

    // 1. Insert order into Supabase REST API (NEVER modifies budget_dzd!)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: "POST",
      headers: {
        ...SB_HEADERS,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id,
        source,
        first_name: customerName,
        last_name: "",
        phone: phone || "",
        address: address || "",
        wilaya: wilaya || "",
        commune: commune || "",
        delivery_type: deliveryType || "",
        delivery_cost: Number(deliveryCost) || 0,
        promo_code: promoCode || "",
        promo_discount: Number(promoDiscount) || 0,
        items: items || [],
        subtotal: Number(subtotal) || 0,
        total: Number(total) || 0,
        status: "waiting",
        paid_amount: 0,
        payment_status: "unpaid",
        payment_history: [],
        created_at: new Date().toISOString(),
      }),
    });

    if (!insertRes.ok) {
      const errData = await insertRes.json().catch(() => ({}));
      return res.status(400).json({ success: false, error: errData.message || "Failed to insert order" });
    }

    // 2. Increment promo code uses for the codes that actually validated.
    // Conditional PATCH prevents two concurrent orders from losing an increment.
    for (const promo of authoritative.validatedPromos) {
      try {
        const promoId = promo.id;
        const maxUses = Number(promo.max_uses !== undefined ? promo.max_uses : promo.maxUses) || 0;
        for (let attempt = 0; attempt < 3; attempt++) {
          const readRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?id=eq.${encodeURIComponent(promoId)}&select=uses&limit=1`, { headers: SB_HEADERS });
          const rows = await readRes.json().catch(() => []);
          if (!readRes.ok || !Array.isArray(rows) || rows.length === 0) break;
          const current = Number(rows[0].uses) || 0;
          if (maxUses > 0 && current >= maxUses) break;
          const limitFilter = maxUses > 0 ? `&uses=lt.${maxUses}` : "";
          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?id=eq.${encodeURIComponent(promoId)}&uses=eq.${current}${limitFilter}`, {
            method: "PATCH",
            headers: { ...SB_HEADERS, Prefer: "return=representation" },
            body: JSON.stringify({ uses: current + 1 }),
          });
          const patched = await patchRes.json().catch(() => null);
          if (!patchRes.ok || !Array.isArray(patched) || patched.length === 0) continue;
          break;
        }
      } catch (_) {}
    }

    // 3. Deduct stock (logged + surfaced in the Telegram alert if anything fails)
    let stockIssues = [];
    try {
      stockIssues = (await adjustStock(items || [], -1)) || [];
    } catch (e) {
      console.error(`[submit-order] adjustStock threw: ${e && e.message}`);
      stockIssues = [`adjustStock threw (${e && e.message})`];
    }

    // 4. Send Telegram notification
    const orderItems = items || [];
    const itemLines = orderItems.map((it) =>
      `  • ${escapeHtml(it.name)}${it.isGift ? ' 🎁 (FREE GIFT)' : ''}${it.flavor ? " – " + escapeHtml(it.flavor) : ""}${it.variant ? " (" + escapeHtml(it.variant) + ")" : ""} x${escapeHtml(String(it.qty ?? 1))}`
    ).join("\n");
    const promoLine = promoCode
      ? `🎟️ Promo: ${escapeHtml(promoCode)} (-${escapeHtml(String(promoDiscount || 0))} DA)\n`
      : "🎟️ No promo code\n";
    const now = new Date();
    const timeStr = now.toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const totalItems = orderItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);
    const stockWarning = stockIssues.length > 0
      ? `⚠️ <b>Stock NOT fully adjusted:</b>\n• ${stockIssues.map(escapeHtml).join("\n• ")}\n\n`
      : "";

    const telegramMsg =
      `🛒 <b>New Order!</b>\n` +
      `🕐 ${timeStr}\n` +
      `📱 Source: ${source === "checkout" ? "Cart" : "Product page"}\n` +
      `👤 ${escapeHtml(customerName)}\n` +
      `📞 ${escapeHtml(phone || "")}\n` +
      `📍 ${escapeHtml(wilaya || "")} – ${escapeHtml(commune || "")}\n` +
      `📦 ${escapeHtml(deliveryType || "")}\n` +
      `🛍️ Items: ${totalItems}\n\n` +
      `${itemLines}\n\n` +
      `🏷️ Products: ${escapeHtml(String(subtotal || 0))} DA\n` +
      `🚚 Delivery: ${escapeHtml(String(deliveryCost || 0))} DA\n` +
      promoLine +
      stockWarning +
      `💰 Total: ${escapeHtml(String(total || 0))} DA`;

    await sendTelegram(telegramMsg).catch(() => {});

    return res.status(200).json({ success: true, id });
  } catch (err) {
    const status = Number(err && err.status) || 500;
    return res.status(status).json({ success: false, error: err.message || "Failed to submit order" });
  }
};
