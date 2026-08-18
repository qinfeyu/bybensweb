import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_ORDERS_CHAT_ID") || Deno.env.get("TELEGRAM_CHAT_ID") || "";

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
    const prodId = item.productId || item.product_id;
    if (!prodId) continue;
    const qty = Number(item.qty) || 1;
    const rawVariant = String(item.variant || "").trim().toLowerCase();
    const rawFlavor = String(item.flavor || "").trim();
    const cleanVar = rawVariant.split("/")[0].replace(/\s+/g, "");

    let prod: any = null;
    const { data: exactRows } = await sb.from("products").select("*").eq("id", prodId).limit(1);
    if (exactRows && exactRows.length > 0) {
      prod = exactRows[0];
    } else {
      // Find product by matching variant SKU (needed for bundle components that use SKU as productId)
      const { data: allProds } = await sb.from("products").select("*");
      if (allProds) {
        prod = allProds.find((p: any) => {
          if (!p.variants || !Array.isArray(p.variants)) return false;
          return p.variants.some((v: any) => {
            if (v.sku && String(v.sku).toLowerCase() === String(prodId).toLowerCase()) return true;
            if (v.flavorSkus) {
               return Object.values(v.flavorSkus).some((s: any) => String(s).toLowerCase() === String(prodId).toLowerCase());
            }
            return false;
          });
        });
      }
    }

    if (!prod) {
      // If still no product, it might be purely an inventory_items SKU with no parent product
      try {
        const targetSku = String(prodId).trim();
        const { data: invRows } = await sb.from("inventory_items").select("*").ilike("id", targetSku).limit(1);
        if (invRows && invRows.length > 0) {
          const curStock = Number(invRows[0].stock) || 0;
          const newInvStock = Math.max(0, curStock + direction * qty);
          await sb.from("inventory_items").update({ stock: newInvStock }).eq("id", invRows[0].id);
        }
      } catch (err) {}
      continue;
    }
    
    // Ensure we use the real product ID for updates (in case we matched by SKU)
    const realProdId = prod.id;

    // Recursive stock adjustment for bundles
    if (prod.bundle_items && Array.isArray(prod.bundle_items) && prod.bundle_items.length > 0) {
      const nestedItems = prod.bundle_items.map((bItem: any) => ({
        productId: bItem.productId || bItem.sku,
        qty: (Number(bItem.qty) || 1) * qty,
        variant: bItem.variant || "",
        flavor: bItem.flavor || "",
      }));
      await adjustStock(nestedItems, direction);
      
      const newBundleStock = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
      await sb.from("products").update({ stock: newBundleStock }).eq("id", realProdId);
      continue;
    }

    const variants: any[] = prod.variants || [];
    let matchedIdx = -1;

    if (variants.length > 0) {
      if (cleanVar) {
        matchedIdx = variants.findIndex((v: any) => {
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
        matchedFlavorKey = Object.keys(v.flavorStock).find(k => k.trim().toLowerCase() === rawFlavor.toLowerCase()) || "";
      }
      if (!matchedFlavorKey && v.flavorStock && Object.keys(v.flavorStock).length === 1) {
        matchedFlavorKey = Object.keys(v.flavorStock)[0];
      }

      if (matchedFlavorKey && v.flavorStock) {
        v.flavorStock[matchedFlavorKey] = Math.max(0, (Number(v.flavorStock[matchedFlavorKey]) || 0) + direction * qty);
        v.stock = Object.values(v.flavorStock).reduce((s: number, q: any) => s + Number(q), 0);
        if (direction < 0 && v.flavorStock[matchedFlavorKey] === 0) {
          await sendTelegram(`⚠️ <b>Out of Stock!</b>\n📦 ${prod.name} – ${matchedFlavorKey} is now out of stock.`);
        }
      } else {
        v.stock = Math.max(0, (Number(v.stock) || 0) + direction * qty);
        if (direction < 0 && v.stock === 0) {
          await sendTelegram(`⚠️ <b>Out of Stock!</b>\n📦 ${prod.name} is now out of stock.`);
        }
      }

      // Find linked SKU
      if (matchedFlavorKey && v.flavorSkus) {
        linkedSku = v.flavorSkus[matchedFlavorKey] || "";
      }
      if (!linkedSku && v.flavorSkus && rawFlavor) {
        const fk = Object.keys(v.flavorSkus).find(k => k.trim().toLowerCase() === rawFlavor.toLowerCase());
        if (fk) linkedSku = v.flavorSkus[fk] || "";
      }
      if (!linkedSku && v.sku) linkedSku = v.sku;

      const newGlobal = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
      await sb.from("products").update({ variants, stock: newGlobal }).eq("id", realProdId);
    } else {
      const newStock = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
      await sb.from("products").update({ stock: newStock }).eq("id", realProdId);
    }

    // ── DEDUCT / RESTORE INVENTORY ITEM SKU STOCK ──
    if (linkedSku && linkedSku.trim()) {
      try {
        const targetSku = linkedSku.trim();
        const { data: invRows } = await sb.from("inventory_items").select("*").ilike("id", targetSku).limit(1);
        if (invRows && invRows.length > 0) {
          const curStock = Number(invRows[0].stock) || 0;
          const newInvStock = Math.max(0, curStock + direction * qty);
          await sb.from("inventory_items").update({ stock: newInvStock }).eq("id", invRows[0].id);
        } else {
          // If SKU row is not in inventory_items yet, create/upsert it with updated stock!
          const v = (matchedIdx >= 0 && variants[matchedIdx]) ? variants[matchedIdx] : null;
          const currentFStock = (v && matchedFlavorKey && v.flavorStock) ? Number(v.flavorStock[matchedFlavorKey]) : (v ? Number(v.stock) : 0);
          const newInvStock = Math.max(0, (Number(currentFStock) || 0) + direction * qty);
          await sb.from("inventory_items").upsert({
            id: targetSku,
            name: `${prod.name}${rawFlavor ? ' (' + rawFlavor + ')' : ''}`,
            brand: prod.brand || '',
            stock: newInvStock,
            price_eur: 0,
            rate: 280,
            delivery_dzd: 0,
            retail_dzd: (v ? Number(v.price) : 0) || 0,
            type: 'supplement'
          }, { onConflict: 'id' });
        }
      } catch (err) {
        console.error("Error updating SKU inventory stock:", err);
      }
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

    // ── LIVE STOCK AVAILABILITY VALIDATION ──
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const prodId = item.productId || item.product_id;
        if (!prodId) continue;
        const reqQty = Number(item.qty) || 1;
        const rawVariant = String(item.variant || "").trim().toLowerCase();
        const rawFlavor = String(item.flavor || "").trim();
        const cleanVar = rawVariant.split("/")[0].replace(/\s+/g, "");

        const { data: pRows } = await sb.from("products").select("*").eq("id", prodId).limit(1);
        if (!pRows || pRows.length === 0) continue;
        const p = pRows[0];

        const variants: any[] = p.variants || [];
        if (variants.length > 0) {
          let mIdx = -1;
          if (cleanVar) {
            mIdx = variants.findIndex((v: any) => {
              if (typeof v !== "object") return String(v).toLowerCase().replace(/\s+/g, "") === cleanVar;
              const vWeight = String(v.weight || "").toLowerCase().replace(/\s+/g, "");
              const vUnit = String(v.unit || "").toLowerCase().replace(/\s+/g, "");
              const vCombo = (vWeight + vUnit);
              const vLabel = String(v.label || v.name || "").toLowerCase().replace(/\s+/g, "");
              return vCombo === cleanVar || vWeight === cleanVar || vLabel === cleanVar || cleanVar.includes(vWeight);
            });
          }
          if (mIdx < 0) mIdx = 0;
          const v = variants[mIdx];
          if (v) {
            let mFlavorKey = "";
            if (rawFlavor && v.flavorStock) {
              mFlavorKey = Object.keys(v.flavorStock).find(k => k.trim().toLowerCase() === rawFlavor.toLowerCase()) || "";
            }
            if (!mFlavorKey && v.flavorStock && Object.keys(v.flavorStock).length === 1) {
              mFlavorKey = Object.keys(v.flavorStock)[0];
            }
            if (mFlavorKey && v.flavorStock) {
              const avail = Number(v.flavorStock[mFlavorKey]) || 0;
              if (avail < reqQty) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Sorry, "${p.name}" (${mFlavorKey}) is out of stock!`
                  }),
                  { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
                );
              }
            } else if (v.stock !== undefined) {
              const avail = Number(v.stock) || 0;
              if (avail < reqQty) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Sorry, "${p.name}" is out of stock!`
                  }),
                  { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
                );
              }
            }
          }
        } else {
          const avail = Number(p.stock) || 0;
          if (avail < reqQty) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Sorry, "${p.name}" is out of stock!`
              }),
              { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
            );
          }
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

    // Revert automatic DB trigger budget addition for 'waiting' orders so budget is only affected on 'delivered' status
    try {
      const { data: setRows } = await sb.from("settings").select("value").eq("key", "budget_dzd").limit(1);
      if (setRows && setRows.length > 0) {
        const curDzd = Number(setRows[0].value) || 0;
        const correctedDzd = Math.round(curDzd - (Number(total) || 0)).toString();
        await sb.from("settings").update({ value: correctedDzd }).eq("key", "budget_dzd");
      }
    } catch (_) {}

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

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

    // Telegram notification
    const orderItems: any[] = items || [];
    const itemLines = orderItems.map((it: any) =>
      `  • ${escapeHtml(it.name)}${it.flavor ? " – " + escapeHtml(it.flavor) : ""}${it.variant ? " (" + escapeHtml(it.variant) + ")" : ""} x${it.qty}`
    ).join("\n");
    const promoLine = promoCode
      ? `🎟️ Promo: ${escapeHtml(promoCode)} (-${promoDiscount || 0} DA)\n`
      : "🎟️ No promo code\n";
    const now = new Date();
    const timeStr = now.toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const totalItems = orderItems.reduce((s: number, it: any) => s + (Number(it.qty) || 1), 0);
    await sendTelegram(
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
