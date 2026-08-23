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
  } catch (err) {
    console.error("Failed to send Telegram daily summary:", err);
  }
}

function parseJsonField(val) {
  if (!val) return [];
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 1. Calculate today's date bounds (Algeria Time UTC+1)
    const now = new Date();
    // Offset for UTC+1
    const dzNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const todayStr = dzNow.toISOString().split("T")[0];
    const startOfTodayIso = `${todayStr}T00:00:00.000Z`;

    // 2. Fetch today's orders
    const ordersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?created_at=gte.${encodeURIComponent(startOfTodayIso)}&select=*`,
      { headers: SB_HEADERS }
    );
    const orders = (await ordersRes.json().catch(() => [])) || [];

    // 3. Fetch products for low-stock check
    const prodsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
      headers: SB_HEADERS,
    });
    const products = (await prodsRes.json().catch(() => [])) || [];

    // Aggregations
    let totalRevenue = 0;
    let storefrontRevenue = 0;
    let storefrontCount = 0;
    let posRevenue = 0;
    let posCount = 0;
    let preorderRevenue = 0;
    let preorderCount = 0;

    let totalItemsSold = 0;
    const itemSalesMap = {}; // item_key -> qty

    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        // Skip canceled orders
        if (o.status === "cancelled" || o.status === "canceled") return;

        const rev = Number(o.total) || 0;
        totalRevenue += rev;

        const src = (o.source || "storefront").toLowerCase();
        if (src === "pos" || src.includes("pos")) {
          posCount++;
          posRevenue += rev;
        } else if (src.includes("pre")) {
          preorderCount++;
          preorderRevenue += rev;
        } else {
          storefrontCount++;
          storefrontRevenue += rev;
        }

        const items = parseJsonField(o.items);
        if (Array.isArray(items)) {
          items.forEach((it) => {
            const qty = Number(it.qty || it.quantity || 1);
            totalItemsSold += qty;
            const name = it.name || it.product_name || "Product";
            const flavor = it.flavor ? ` – ${it.flavor}` : "";
            const key = `${name}${flavor}`;
            itemSalesMap[key] = (itemSalesMap[key] || 0) + qty;
          });
        }
      });
    }

    // Top selling product today
    let topProductStr = "None";
    let topProductQty = 0;
    Object.entries(itemSalesMap).forEach(([k, qty]) => {
      if (qty > topProductQty) {
        topProductQty = qty;
        topProductStr = k;
      }
    });

    // Low stock items scan (stock <= 3)
    const lowStockItems = [];
    if (Array.isArray(products)) {
      products.forEach((p) => {
        const variants = parseJsonField(p.variants);
        const flavorStock = parseJsonField(p.flavor_stock);

        if (Array.isArray(variants) && variants.length > 0) {
          variants.forEach((v) => {
            const vStock = Number(v.stock || 0);
            if (vStock <= 3 && vStock >= 0) {
              const label = v.weight ? `${v.weight}${v.unit || ""}` : v.label || "";
              lowStockItems.push(`${p.name}${label ? " (" + label + ")" : ""}: ${vStock} remaining`);
            }
          });
        } else if (typeof flavorStock === "object" && flavorStock !== null) {
          Object.entries(flavorStock).forEach(([fl, st]) => {
            const stNum = Number(st);
            if (stNum <= 3 && stNum >= 0) {
              lowStockItems.push(`${p.name} (${fl}): ${stNum} remaining`);
            }
          });
        } else {
          const st = Number(p.stock || 0);
          if (st <= 3 && st >= 0) {
            lowStockItems.push(`${p.name}: ${st} remaining`);
          }
        }
      });
    }

    // Formatted date string for Algeria
    const dateFormatted = new Date().toLocaleDateString("fr-DZ", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Build Telegram Summary Message
    const lowStockSection =
      lowStockItems.length > 0
        ? `⚠️ <b>Low Stock Warnings (${lowStockItems.length}):</b>\n` +
          lowStockItems.slice(0, 5).map((s) => `  • ${escapeHtml(s)}`).join("\n") +
          (lowStockItems.length > 5 ? `\n  <i>...and ${lowStockItems.length - 5} more</i>` : "")
        : "✅ <b>Inventory Status:</b> All products well stocked.";

    const telegramMsg =
      `📊 <b>ByBens Daily Business Summary</b>\n` +
      `📅 <i>${escapeHtml(dateFormatted)}</i>\n\n` +
      `💰 <b>Total Sales Revenue:</b> ${totalRevenue.toLocaleString("fr-DZ")} DA\n` +
      `📦 <b>Total Orders:</b> ${orders.length} orders (${totalItemsSold} items)\n\n` +
      `🛒 <b>Storefront Web:</b> ${storefrontCount} orders (${storefrontRevenue.toLocaleString("fr-DZ")} DA)\n` +
      `🏪 <b>POS In-Store:</b> ${posCount} sales (${posRevenue.toLocaleString("fr-DZ")} DA)\n` +
      (preorderCount > 0 ? `📦 <b>Pre-Orders:</b> ${preorderCount} orders (${preorderRevenue.toLocaleString("fr-DZ")} DA)\n` : "") +
      `\n🔥 <b>Top Seller Today:</b> ${escapeHtml(topProductStr)} (${topProductQty} sold)\n\n` +
      `${lowStockSection}\n\n` +
      `<i>Automated daily report generated at ${new Date().toLocaleTimeString("fr-DZ")}</i>`;

    // 4. Send Telegram message
    await sendTelegram(telegramMsg);

    return res.status(200).json({
      success: true,
      summary: {
        date: todayStr,
        totalOrders: orders.length,
        totalRevenue,
        storefrontCount,
        storefrontRevenue,
        posCount,
        posRevenue,
        preorderCount,
        preorderRevenue,
        totalItemsSold,
        topSeller: { name: topProductStr, qty: topProductQty },
        lowStockCount: lowStockItems.length,
        lowStockItems,
      },
    });
  } catch (err) {
    console.error("Daily summary cron error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate daily summary" });
  }
};
