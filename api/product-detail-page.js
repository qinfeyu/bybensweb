const fs = require("fs");
const path = require("path");

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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripTags(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function optimizeCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.indexOf("res.cloudinary.com") !== -1 && url.indexOf("/upload/") !== -1) {
    if (url.indexOf("/f_auto") !== -1 || url.indexOf("/q_auto") !== -1) return url;
    return url.replace("/upload/", "/upload/f_auto,q_auto/");
  }
  return url;
}

async function sf(pathStr) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathStr}`, { headers: SB_HEADERS });
    const data = await res.json().catch(() => ([]));
    if (!res.ok) return [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600, max-age=30");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  let baseHtml = "";
  try {
    const filePath = path.join(process.cwd(), "supplements/product-detail/template.html");
    baseHtml = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    baseHtml = `<!doctype html><html><head><title>ByBens</title></head><body>Loading...</body></html>`;
  }

  const productId = req.query.id;
  if (!productId) {
    return res.status(200).send(baseHtml);
  }

  try {
    // 1. Direct query by ID
    let rows = await sf(`products?select=id,name,brand,description,image_url,variants,discount&id=eq.${encodeURIComponent(productId)}&limit=1`);

    // 2. Fallback to initial-data endpoint if direct REST failed
    if (!Array.isArray(rows) || rows.length === 0) {
      const host = req.headers["x-forwarded-host"] || req.headers.host || "www.bybens.com";
      const proto = req.headers["x-forwarded-proto"] || "https";
      const initRes = await fetch(`${proto}://${host}/api/initial-data`).catch(() => null);
      if (initRes && initRes.ok) {
        const initData = await initRes.json().catch(() => ({}));
        if (Array.isArray(initData.products)) {
          rows = initData.products;
        }
      }
    }

    const prod = Array.isArray(rows)
      ? rows.find((p) => String(p.id).trim() === String(productId).trim())
      : null;

    if (prod) {
      const prodName = prod.name ? `${prod.name}${prod.brand ? " by " + prod.brand : ""}` : "Product Details";
      const pageTitle = `${prodName} – ByBens Sports Nutrition Algeria`;

      let rawImgs = Array.isArray(prod.image_url) ? prod.image_url : (prod.image_url ? [prod.image_url] : []);
      let mainImg = rawImgs.length > 0 ? optimizeCloudinaryUrl(rawImgs[0]) : "https://www.bybens.com/images/logo.png";
      if (mainImg.startsWith("/")) {
        mainImg = `https://www.bybens.com${mainImg}`;
      }

      let priceStr = "";
      let vars = [];
      if (Array.isArray(prod.variants)) vars = prod.variants;
      else if (typeof prod.variants === "string") {
        try { vars = JSON.parse(prod.variants); } catch (_) {}
      }

      let basePrice = (vars.length > 0 && Number(vars[0].price)) ? Number(vars[0].price) : (Number(prod.price) || 0);
      let disc = Number(prod.discount) || 0;
      let finalPrice = basePrice;
      if (disc > 0) {
        if (disc <= 100) finalPrice = Math.max(0, Math.round(basePrice * (1 - disc / 100)));
        else finalPrice = Math.max(0, Math.round(basePrice - disc));
      }
      if (finalPrice > 0) {
        priceStr = ` – ${finalPrice.toLocaleString("fr-DZ")} DA`;
      }

      const cleanDesc = stripTags(prod.description) || `${prodName} — Premium sports nutrition available at ByBens Algeria. Fast delivery nationwide.`;
      const shortDesc = cleanDesc.length > 200 ? cleanDesc.slice(0, 197) + "..." : cleanDesc;
      const fullOgDesc = `${shortDesc}${priceStr}`;
      const canonicalUrl = `https://www.bybens.com/supplements/product-detail?id=${encodeURIComponent(productId)}`;

      // Inject dynamic meta tags into HTML <head>
      let modifiedHtml = baseHtml;

      // Title
      modifiedHtml = modifiedHtml.replace(
        /<title>.*?<\/title>/i,
        `<title>${escapeHtml(pageTitle)}</title>`
      );

      // Open Graph Meta Tags
      const metaTagsHtml = `
    <!-- Dynamic Product Social Meta Tags -->
    <meta property="og:type" content="og:product" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(fullOgDesc)}" />
    <meta property="og:image" content="${escapeHtml(mainImg)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(mainImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="ByBens Sports Nutrition" />
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(fullOgDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImg)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
`;

      if (modifiedHtml.includes("</head>")) {
        modifiedHtml = modifiedHtml.replace("</head>", `${metaTagsHtml}</head>`);
      }

      return res.status(200).send(modifiedHtml);
    }
  } catch (_) {}

  return res.status(200).send(baseHtml);
};
