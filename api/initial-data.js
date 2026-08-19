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

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function sf(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Supabase API error on ${path} [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = async function handler(_req, res) {
  try {
    if (!SUPABASE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is missing from environment variables.");
    }

    const [rawProducts, categories, subCategories, bundle, promos, deliveryPrices, settings] = await Promise.all([
      sf("products?select=id,name,brand,category_ids,sub_category_ids,description,benefits,nutritional_facts,image_url,variants,flavors,stock,discount,allow_promo,promo_code_ids,status,created_at,hidden,bundle_items&order=created_at.asc"),
      sf("categories?select=*&order=created_at.asc"),
      sf("sub_categories?select=*"),
      sf("bundle?select=*&limit=1"),
      sf("promo_codes?select=*&order=created_at.desc"),
      sf("delivery_prices?select=*&order=wilaya.asc"),
      sf("settings?select=*"),
    ]);

    const products = Array.isArray(rawProducts) ? rawProducts.filter((p) => !p.hidden) : [];

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300, max-age=15");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      products,
      categories: Array.isArray(categories) ? categories : [],
      subCategories: Array.isArray(subCategories) ? subCategories : [],
      bundle: Array.isArray(bundle) ? bundle[0] || {} : bundle || {},
      promos: Array.isArray(promos) ? promos : [],
      deliveryPrices: Array.isArray(deliveryPrices) ? deliveryPrices : [],
      settings: Array.isArray(settings) ? settings : [],
      orders: [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
