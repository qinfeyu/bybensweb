import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";
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

async function adjustStock(items: any[], direction: number) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    const prodId = item.productId || item.product_id;
    if (!prodId) continue;
    const qty = Number(item.qty) || 1;
    const rawVariant = String(item.variant || "").trim().toLowerCase();
    const rawFlavor = String(item.flavor || "").trim();
    const cleanVar = rawVariant.split("/")[0].replace(/\s+/g, "");

    const { data: rows } = await sb.from("products").select("*").eq("id", prodId).limit(1);
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

      const newGlobal = variants.reduce((s: number, vv: any) => s + (typeof vv === "object" ? Number(vv.stock) || 0 : 0), 0);
      await sb.from("products").update({ variants, stock: newGlobal }).eq("id", prodId);
    } else {
      const newStock = Math.max(0, (Number(prod.stock) || 0) + direction * qty);
      await sb.from("products").update({ stock: newStock }).eq("id", prodId);
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
    const { action, id, status } = body;

    if (action === "listOrders" || action === "list") {
      const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, orders: data || [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!id || !status) {
      return new Response(JSON.stringify({ success: false, error: "id and status required" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Read current order
    const { data: orderRows } = await sb.from("orders").select("*").eq("id", id).limit(1);
    if (!orderRows || orderRows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const order = orderRows[0];
    const oldStatus = order.status || "waiting";
    const items: any[] = order.items || [];

    // Update status
    const { error } = await sb.from("orders").update({ status }).eq("id", id);
    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Stock adjustments
    if (oldStatus !== "canceled" && status === "canceled") {
      await adjustStock(items, +1); // restore
    } else if (oldStatus === "canceled" && status !== "canceled") {
      await adjustStock(items, -1); // re-deduct
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
