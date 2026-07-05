const SUPABASE_URL = process.env.SUPABASE_URL || "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZXpycnptY29zeGRvb3Jicmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcxODExOSwiZXhwIjoyMDk1Mjk0MTE5fQ.TJLVdjwyNCKhS0vyFlUnRW6LQLvotuuFqxUj6H2-JGs";

const SB_HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

function sf(path) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS }).then((r) => r.json());
}

module.exports = async function handler(_req, res) {
  try {
    const [products, categories, subCategories, bundle, promos, deliveryPrices] = await Promise.all([
      sf(
        "products?select=id,name,brand,category_ids,sub_category_ids,description,image_url,variants,flavors,stock,discount,allow_promo,promo_code_ids,status,created_at,hidden&hidden=not.is.true&order=created_at.asc"
      ),
      sf("categories?select=*&order=created_at.asc"),
      sf("sub_categories?select=*"),
      sf("bundle?select=*&limit=1"),
      sf("promo_codes?select=*&order=created_at.desc"),
      sf("delivery_prices?select=*&order=wilaya.asc"),
    ]);

    // 5-minute Vercel edge cache; stale-while-revalidate keeps the site fast during refresh
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      products,
      categories,
      subCategories,
      bundle: Array.isArray(bundle) ? bundle[0] || {} : bundle || {},
      promos,
      deliveryPrices,
      orders: [], // orders are never exposed to public visitors
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
