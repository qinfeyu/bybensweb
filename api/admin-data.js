const SUPABASE_URL = "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_KEY = Buffer.from("c2Jfc2VjcmV0X05SOTgxcWo2WGdyTGZHQ2M5WmRrWndfNXJ5UUg4bk0=", "base64").toString();

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
