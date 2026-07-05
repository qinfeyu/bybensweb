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

    // Fallback: old system
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
    const { id, status } = await req.json();
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
