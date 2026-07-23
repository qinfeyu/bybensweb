import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZXpycnptY29zeGRvb3Jicmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcxODExOSwiZXhwIjoyMDk1Mjk0MTE5fQ.TJLVdjwyNCKhS0vyFlUnRW6LQLvotuuFqxUj6H2-JGs";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "8597076283:AAEcCim85KCQZQC-5ik4SLXdS8xPvOJg__o";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "-1003790940322";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendTelegram(message: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" }),
    });
  } catch (_) { /* silent */ }
}

// Port of _adjustStock from code.gs (direction: -1 deduct, +1 restore)
async function adjustStock(items: any[], direction: number) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (!item.productId) continue;
    const qty = Number(item.qty) || 1;
    const itemVariantLabel = String(item.variant || "").trim().toLowerCase();
    const itemFlavor = String(item.flavor || "").trim();

    const { data: rows } = await sb.from("products").select("*").eq("id", item.productId).limit(1);
    if (!rows || rows.length === 0) continue;
    const prod = rows[0];

    // Recursive stock adjustment for bundles
    if (prod.bundle_items && Array.isArray(prod.bundle_items) && prod.bundle_items.length > 0) {
      const nestedItems = prod.bundle_items.map((bItem: any) => ({
        productId: bItem.productId,
        qty: (Number(bItem.qty) || 1) * qty,
        variant: bItem.variant || "",
        flavor: bItem.flavor || "",
      }));
      await adjustStock(nestedItems, direction);
      continue;
    }

    const variants: any[] = prod.variants || [];
    const flavors: any[] = prod.flavors || [];

    // Try new system: match variant by label
    let matchedIdx = -1;
    if (itemVariantLabel && variants.length > 0) {
      matchedIdx = variants.findIndex((v: any) => {
        if (typeof v !== "object") return String(v).toLowerCase() === itemVariantLabel;
        const vLabel = v.weight
          ? `${v.weight}${v.unit || ""}`.trim().toLowerCase()
          : String(v.label || v.name || "").trim().toLowerCase();
        return vLabel === itemVariantLabel;
      });
    }

    if (matchedIdx >= 0) {
      const v = variants[matchedIdx];
      let matchedFlavorKey = "";
      if (itemFlavor && v.flavorStock) {
        matchedFlavorKey = Object.keys(v.flavorStock).find(k => k.trim().toLowerCase() === itemFlavor.toLowerCase()) || "";
      }
      if (matchedFlavorKey) {
        v.flavorStock[matchedFlavorKey] = Math.max(0, (Number(v.flavorStock[matchedFlavorKey]) || 0) + direction * qty);
        v.stock = Object.values(v.flavorStock).reduce((s: number, q: any) => s + Number(q), 0);
        if (direction < 0 && v.flavorStock[matchedFlavorKey] === 0) {
          await sendTelegram(`⚠️ <b>Out of Stock!</b>\n📦 ${prod.name} – ${matchedFlavorKey} (${itemVariantLabel}) is now out of stock.`);
        }
      } else {
        v.stock = Math.max(0, (Number(v.stock) || 0) + direction * qty);
        if (direction < 0 && v.stock === 0) {
          await sendTelegram(`⚠️ <b>Out of Stock!</b>\n📦 ${prod.name} (${itemVariantLabel}) is now out of stock.`);
        }
      }
      const newGlobal = variants.reduce((s: number, vv: any) => s + (typeof vv === "object" ? Number(vv.stock) || 0 : 0), 0);
      await sb.from("products").update({ variants, stock: newGlobal }).eq("id", item.productId);
      continue;
    }

    // Try atomic RPC deduction first
    try {
      const { data: rpcSuccess } = await sb.rpc("deduct_product_stock", { p_product_id: item.productId, p_qty: qty * (direction < 0 ? 1 : -1) });
      if (rpcSuccess) continue;
    } catch (_) { /* fallback to standard update */ }

    // Fallback: standard system update
    let updatedFlavors = flavors;
    if (itemFlavor) {
      let changed = false;
      updatedFlavors = flavors.map((f: any) => {
        const fName = typeof f === "object" ? String(f.name || "") : String(f);
        if (fName.toLowerCase() === itemFlavor.toLowerCase()) {
          changed = true;
          return { ...f, qty: Math.max(0, (Number(f.qty) || 0) + direction * qty) };
        }
        return f;
      });
      if (changed) {
        await sb.from("products").update({ flavors: updatedFlavors }).eq("id", item.productId);
      }
    }
    const newStock = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
    await sb.from("products").update({ stock: newStock }).eq("id", item.productId);
    if (direction < 0 && newStock === 0) {
      await sendTelegram(`⚠️ <b>Out of Stock!</b>\n📦 ${prod.name}${itemFlavor ? " – " + itemFlavor : ""} is now out of stock.`);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json();
    const {
      action, firstName, lastName, phone, address, wilaya, commune,
      deliveryType, deliveryCost, promoCode, promoDiscount,
      items, subtotal, total,
    } = body;

    // Server-side promo re-validation
    if (promoCode) {
      const codes = String(promoCode).split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean);
      for (const code of codes) {
        const { data: promoRows } = await sb.from("promo_codes").select("*").ilike("code", code).limit(1);
        if (!promoRows || promoRows.length === 0) continue;
        const pr = promoRows[0];
        if (pr.status !== "active") {
          return new Response(JSON.stringify({ success: false, error: `Promo code ${code} is no longer active.` }), {
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        if (pr.expiry) {
          const exp = new Date(pr.expiry);
          exp.setHours(23, 59, 59, 999);
          if (exp < new Date()) {
            return new Response(JSON.stringify({ success: false, error: `Promo code ${code} has expired.` }), {
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }
        }
        if (pr.max_uses && Number(pr.uses) >= Number(pr.max_uses)) {
          return new Response(JSON.stringify({ success: false, error: `Promo code ${code} has reached its usage limit.` }), {
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      }
    }

    const id = Date.now().toString();
    const source = action === "submitCartOrder" ? "checkout" : "product-detail";

    const { error: insertErr } = await sb.from("orders").insert({
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
    });

    if (insertErr) {
      return new Response(JSON.stringify({ success: false, error: insertErr.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Increment promo uses
    if (promoCode) {
      const codes = String(promoCode).split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean);
      for (const code of codes) {
        const { data: promoRows } = await sb.from("promo_codes").select("id, uses").ilike("code", code).limit(1);
        if (promoRows && promoRows.length > 0) {
          await sb.from("promo_codes").update({ uses: (Number(promoRows[0].uses) || 0) + 1 }).eq("id", promoRows[0].id);
        }
      }
    }

    // Deduct stock
    await adjustStock(items || [], -1);

    // Telegram notification
    const orderItems: any[] = items || [];
    const itemLines = orderItems.map((it: any) =>
      `  • ${it.name}${it.flavor ? " – " + it.flavor : ""}${it.variant ? " (" + it.variant + ")" : ""} x${it.qty}`
    ).join("\n");
    const promoLine = promoCode
      ? `🎟️ Promo: ${promoCode} (-${promoDiscount || 0} DA)\n`
      : "🎟️ No promo code\n";
    const now = new Date();
    const timeStr = now.toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const totalItems = orderItems.reduce((s: number, it: any) => s + (Number(it.qty) || 1), 0);
    await sendTelegram(
      `🛒 <b>New Order!</b>\n` +
      `🕐 ${timeStr}\n` +
      `📱 Source: ${source === "checkout" ? "Cart" : "Product page"}\n` +
      `👤 ${firstName || ""} ${lastName || ""}\n` +
      `📞 ${phone || ""}\n` +
      `📍 ${wilaya || ""} – ${commune || ""}\n` +
      `📦 ${deliveryType || ""}\n` +
      `🛍️ Items: ${totalItems}\n\n` +
      `${itemLines}\n\n` +
      `🏷️ Products: ${subtotal || 0} DA\n` +
      `🚚 Delivery: ${deliveryCost || 0} DA\n` +
      promoLine +
      `💰 Total: ${total || 0} DA`
    );

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
