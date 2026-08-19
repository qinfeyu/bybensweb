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

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "8737005667:AAGyExL8mgh8YxNaKGjzo6O99IuflmGA5rg";

const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_ORDERS_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID ||
  "-1003790940322";

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

async function adjustStock(items, direction) {
  if (!items || !Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    const prodId = item.productId || item.product_id;
    if (!prodId) continue;
    const qty = Number(item.qty) || 1;
    const rawVariant = String(item.variant || "").trim().toLowerCase();
    const rawFlavor = String(item.flavor || "").trim();
    const cleanVar = rawVariant.split("/")[0].replace(/\s+/g, "");

    // Fetch product
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(prodId)}&limit=1`, { headers: SB_HEADERS });
    const pRows = await pRes.json().catch(() => ([]));
    let prod = Array.isArray(pRows) && pRows.length > 0 ? pRows[0] : null;

    if (!prod) {
      // Try finding product by matching SKU
      const allRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, { headers: SB_HEADERS });
      const allProds = await allRes.json().catch(() => ([]));
      if (Array.isArray(allProds)) {
        prod = allProds.find((p) => {
          if (!p.variants || !Array.isArray(p.variants)) return false;
          return p.variants.some((v) => {
            if (v.sku && String(v.sku).toLowerCase() === String(prodId).toLowerCase()) return true;
            if (v.flavorSkus) {
              return Object.values(v.flavorSkus).some((s) => String(s).toLowerCase() === String(prodId).toLowerCase());
            }
            return false;
          });
        });
      }
    }

    if (!prod) {
      // Try inventory_items SKU
      try {
        const targetSku = String(prodId).trim();
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/inventory_items?id=ilike.${encodeURIComponent(targetSku)}&limit=1`, { headers: SB_HEADERS });
        const invRows = await invRes.json().catch(() => ([]));
        if (Array.isArray(invRows) && invRows.length > 0) {
          const curStock = Number(invRows[0].stock) || 0;
          const newInvStock = Math.max(0, curStock + direction * qty);
          await fetch(`${SUPABASE_URL}/rest/v1/inventory_items?id=eq.${encodeURIComponent(invRows[0].id)}`, {
            method: "PATCH",
            headers: SB_HEADERS,
            body: JSON.stringify({ stock: newInvStock }),
          });
        }
      } catch (_) {}
      continue;
    }

    const realProdId = prod.id;
    const variants = Array.isArray(prod.variants) ? prod.variants : [];
    let matchedIdx = -1;

    if (variants.length > 0) {
      if (cleanVar) {
        matchedIdx = variants.findIndex((v) => {
          if (typeof v !== "object") return String(v).toLowerCase().replace(/\s+/g, "") === cleanVar;
          const vWeight = String(v.weight || "").toLowerCase().replace(/\s+/g, "");
          const vUnit = String(v.unit || "").toLowerCase().replace(/\s+/g, "");
          const vCombo = (vWeight + vUnit);
          const vLabel = String(v.label || v.name || "").toLowerCase().replace(/\s+/g, "");
          return vCombo === cleanVar || vWeight === cleanVar || vLabel === cleanVar || cleanVar.includes(vWeight);
        });
      }
      if (matchedIdx < 0) matchedIdx = 0;
    }

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

      const newGlobal = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
      await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(realProdId)}`, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify({ variants, stock: newGlobal }),
      });
    } else {
      const newStock = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
      await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(realProdId)}`, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify({ stock: newStock }),
      });
    }

    // SKU Inventory deduction
    if (linkedSku && linkedSku.trim()) {
      try {
        const targetSku = linkedSku.trim();
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/inventory_items?id=ilike.${encodeURIComponent(targetSku)}&limit=1`, { headers: SB_HEADERS });
        const invRows = await invRes.json().catch(() => ([]));
        if (Array.isArray(invRows) && invRows.length > 0) {
          const curStock = Number(invRows[0].stock) || 0;
          const newInvStock = Math.max(0, curStock + direction * qty);
          await fetch(`${SUPABASE_URL}/rest/v1/inventory_items?id=eq.${encodeURIComponent(invRows[0].id)}`, {
            method: "PATCH",
            headers: SB_HEADERS,
            body: JSON.stringify({ stock: newInvStock }),
          });
        }
      } catch (_) {}
    }
  }
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
      action, firstName, lastName, phone, address, wilaya, commune,
      deliveryType, deliveryCost, promoCode, promoDiscount,
      items, subtotal, total,
    } = body;

    const id = Date.now().toString();
    const source = action === "submitCartOrder" ? "checkout" : "product-detail";

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
        first_name: firstName || "",
        last_name: lastName || "",
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
        created_at: new Date().toISOString(),
      }),
    });

    if (!insertRes.ok) {
      const errData = await insertRes.json().catch(() => ({}));
      return res.status(400).json({ success: false, error: errData.message || "Failed to insert order" });
    }

    // 2. Increment promo code uses if applied
    if (promoCode) {
      try {
        const codes = String(promoCode).split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
        for (const code of codes) {
          const prRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=ilike.${encodeURIComponent(code)}&limit=1`, { headers: SB_HEADERS });
          const promoRows = await prRes.json().catch(() => ([]));
          if (Array.isArray(promoRows) && promoRows.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?id=eq.${encodeURIComponent(promoRows[0].id)}`, {
              method: "PATCH",
              headers: SB_HEADERS,
              body: JSON.stringify({ uses: (Number(promoRows[0].uses) || 0) + 1 }),
            });
          }
        }
      } catch (_) {}
    }

    // 3. Deduct stock asynchronously
    adjustStock(items || [], -1).catch(() => {});

    // 4. Send Telegram notification
    const orderItems = items || [];
    const itemLines = orderItems.map((it) =>
      `  • ${escapeHtml(it.name)}${it.flavor ? " – " + escapeHtml(it.flavor) : ""}${it.variant ? " (" + escapeHtml(it.variant) + ")" : ""} x${it.qty}`
    ).join("\n");
    const promoLine = promoCode
      ? `🎟️ Promo: ${escapeHtml(promoCode)} (-${promoDiscount || 0} DA)\n`
      : "🎟️ No promo code\n";
    const now = new Date();
    const timeStr = now.toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const totalItems = orderItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);

    const telegramMsg =
      `🛒 <b>New Order!</b>\n` +
      `🕐 ${timeStr}\n` +
      `📱 Source: ${source === "checkout" ? "Cart" : "Product page"}\n` +
      `👤 ${escapeHtml(firstName || "")} ${escapeHtml(lastName || "")}\n` +
      `📞 ${escapeHtml(phone || "")}\n` +
      `📍 ${escapeHtml(wilaya || "")} – ${escapeHtml(commune || "")}\n` +
      `📦 ${escapeHtml(deliveryType || "")}\n` +
      `🛍️ Items: ${totalItems}\n\n` +
      `${itemLines}\n\n` +
      `🏷️ Products: ${subtotal || 0} DA\n` +
      `🚚 Delivery: ${deliveryCost || 0} DA\n` +
      promoLine +
      `💰 Total: ${total || 0} DA`;

    sendTelegram(telegramMsg).catch(() => {});

    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to submit order" });
  }
};
