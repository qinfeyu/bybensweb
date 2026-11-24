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

const { applyAdminCors, requireAdmin } = require("./_lib/admin-auth");

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function sf(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    console.error(`Supabase query ${path} failed (${res.status}):`, data);
    return Array.isArray(data) ? data : [];
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (!applyAdminCors(req, res)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const [
      inventoryItems,
      categories,
      subCategories,
      products,
      orders,
      preOrders,
      preOrderItems,
      expenses,
      customers,
      settings,
      deliveryPrices,
      promoCodes,
      bundle,
      giftConfig,
      notes,
      popups,
    ] = await Promise.all([
      sf("inventory_items?select=*&order=created_at.desc"),
      sf("categories?select=*&order=created_at.asc"),
      sf("sub_categories?select=*"),
      sf("products?select=*&order=created_at.asc"),
      sf("orders?select=*&order=created_at.desc"),
      sf("pre_orders?select=*&order=date.desc"),
      sf("pre_order_items?select=*"),
      sf("expenses?select=*&order=date.desc"),
      sf("customers?select=*"),
      sf("settings?select=*"),
      sf("delivery_prices?select=*&order=wilaya.asc"),
      sf("promo_codes?select=*&order=created_at.desc"),
      sf("bundle?select=*&limit=1"),
      sf("gift_config?select=*&limit=1"),
      sf("notes?select=*&limit=1"),
      sf("popups?select=*&order=priority.desc,created_at.desc"),
    ]);

    return res.status(200).json({
      success: true,
      inventoryItems: Array.isArray(inventoryItems) ? inventoryItems : [],
      categories: Array.isArray(categories) ? categories : [],
      subCategories: Array.isArray(subCategories) ? subCategories : [],
      products: Array.isArray(products) ? products : [],
      orders: Array.isArray(orders) ? orders : [],
      preOrders: Array.isArray(preOrders) ? preOrders : [],
      preOrderItems: Array.isArray(preOrderItems) ? preOrderItems : [],
      expenses: Array.isArray(expenses) ? expenses : [],
      customers: Array.isArray(customers) ? customers : [],
      settings: Array.isArray(settings) ? settings : [],
      deliveryPrices: Array.isArray(deliveryPrices) ? deliveryPrices : [],
      promoCodes: Array.isArray(promoCodes) ? promoCodes : [],
      bundle: Array.isArray(bundle) ? bundle[0] || {} : bundle || {},
      giftConfig: Array.isArray(giftConfig) ? giftConfig[0] || {} : giftConfig || {},
      notes: Array.isArray(notes) ? notes[0] || {} : notes || {},
      popups: Array.isArray(popups) ? popups : [],
    });
  } catch (e) {
    console.error("[admin-data]", e && e.message ? e.message : e);
    return res.status(500).json({ error: "Unable to load admin data. Please try again." });
  }
};
