const ECOTRACK_API_TOKEN = process.env.ECOTRACK_API_TOKEN || "";
const ECOTRACK_API_URL = process.env.ECOTRACK_API_URL || "https://app.ecotrack.dz/api/v1/create/order";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

function normalizeString(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Remove spaces, hyphens, etc.
}

// Best-effort in-memory rate limits, keyed on the ingress IP. Deterrent only:
// counters reset on cold start. Every public lookup is throttled; receipt
// downloads (which carry PII) get a stricter cap.
const LOOKUP_THROTTLE_MAX = 60;
const LOOKUP_THROTTLE_WINDOW_MS = 60 * 1000;
const RECEIPT_THROTTLE_MAX = 10;
const RECEIPT_THROTTLE_WINDOW_MS = 60 * 1000;
const lookupThrottle = new Map();
const receiptThrottle = new Map();

function isThrottled(map, ip, max, windowMs) {
  if (!ip) return true;
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry || now - entry.t0 > windowMs) {
    map.set(ip, { count: 1, t0: now });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

function getClientIp(req) {
  const headers = (req && req.headers) || {};
  return String(headers["x-vercel-forwarded-for"] || headers["x-forwarded-for"] || headers["x-real-ip"] || "")
    .split(",")[0]
    .trim();
}

function normalizeDzPhone(value) {
  let digits = String(value || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("00213")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("213")) digits = `0${digits.slice(3)}`;
  // Legacy rows may store the 9-digit national form without the leading zero.
  if (/^[0-9]{9}$/.test(digits)) digits = `0${digits}`;
  return digits;
}

function isValidDzPhone(phone) {
  return /^0[0-9]{9}$/.test(phone);
}

async function handleGet(req, res) {
  try {
    const orderId = req.query.orderId || req.query.id;
    const phone = req.query.phone;

    if (!orderId || !phone) {
      return res.status(400).json({ success: false, error: "Order ID and Phone Number are required." });
    }

    // Fail closed when the platform does not give us an ingress IP: every public
    // lookup (including receipts) is throttled, with a stricter cap for receipts.
    const clientIp = getClientIp(req);
    if (!clientIp) {
      return res.status(429).json({ success: false, error: "Unable to determine request origin. Please try again later." });
    }
    const isReceipt = req.query.receipt === "1";
    if (isThrottled(
      isReceipt ? receiptThrottle : lookupThrottle,
      clientIp,
      isReceipt ? RECEIPT_THROTTLE_MAX : LOOKUP_THROTTLE_MAX,
      isReceipt ? RECEIPT_THROTTLE_WINDOW_MS : LOOKUP_THROTTLE_WINDOW_MS,
    )) {
      return res.status(429).json({ success: false, error: "Too many lookup requests. Please try again later." });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ success: false, error: "Database configuration missing." });
    }

    // 1. Fetch order from Supabase
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,phone,status,ecotrack_id&limit=1`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });
    let orders = await sbRes.json().catch(() => []);

    // If 'ecotrack_id' column doesn't exist, Supabase returns an error object, not an array.
    if (!Array.isArray(orders)) {
      // Fallback: try fetching without ecotrack_id to at least verify the order exists
      const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,phone,status&limit=1`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
      });
      orders = await fallbackRes.json().catch(() => []);
      
      if (!Array.isArray(orders)) {
        return res.status(500).json({ success: false, error: "Database error. Please ensure the ecotrack_id column is created." });
      }
    }

    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    const order = orders[0];

    // 2. Validate the full phone number (exact match, not a last-N-digits suffix)
    // to prevent cross-order enumeration. Prefixes and formatting are normalized.
    const inputPhone = normalizeDzPhone(phone);
    const storedPhone = normalizeDzPhone(order.phone);
    if (!isValidDzPhone(inputPhone) || storedPhone !== inputPhone) {
      return res.status(401).json({ success: false, error: "Phone number does not match this order." });
    }

    // Client receipt re-download. Must run BEFORE the no-trackingId early return so a
    // freshly placed (not yet dispatched) order can still download its receipt. The
    // phone check above is already an exact normalized match; the stricter receipt
    // throttle was applied at the top of handleGet.
    if (isReceipt) {
      const receiptRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,first_name,last_name,phone,wilaya,commune,address,delivery_type,created_at,items,subtotal,delivery_cost,promo_discount,promo_code,total&limit=1`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
      });
      const receiptRows = await receiptRes.json().catch(() => []);
      const row = Array.isArray(receiptRows) ? receiptRows[0] : null;
      if (!row) {
        return res.status(404).json({ success: false, error: "Order receipt not found." });
      }

      const items = (Array.isArray(row.items) ? row.items : []).map((it) => ({
        productId: it.productId !== undefined ? it.productId : (it.product_id || ""),
        name: it.name || "",
        isGift: !!it.isGift,
        flavor: it.flavor || "",
        variant: it.variant || "",
        qty: Number(it.qty) || 1,
        unitPrice: Number(it.unitPrice !== undefined ? it.unitPrice : it.unit_price) || 0,
        lineTotal: Number(it.lineTotal !== undefined ? it.lineTotal : it.line_total) || 0,
      }));

      return res.status(200).json({
        success: true,
        receipt: {
          orderId: row.id,
          createdAt: row.created_at || null,
          customer: {
            firstName: row.first_name || "",
            lastName: row.last_name || "",
            phone: row.phone || "",
            wilaya: row.wilaya || "",
            commune: row.commune || "",
            address: row.address || "",
          },
          deliveryType: row.delivery_type || "home",
          items,
          subtotal: Number(row.subtotal) || 0,
          deliveryCost: Number(row.delivery_cost) || 0,
          promoDiscount: Number(row.promo_discount) || 0,
          promoCode: row.promo_code || "",
          total: Number(row.total) || 0,
        },
      });
    }

    // 3. Check if tracking ID exists
    const trackingId = order.ecotrack_id;
    if (!trackingId) {
      return res.status(200).json({
        success: true,
        tracking: null,
        message: "Your order is being processed and has not been dispatched to the delivery company yet.",
        status: order.status
      });
    }

    if (!ECOTRACK_API_TOKEN) {
      return res.status(500).json({ success: false, error: "Ecotrack API not configured." });
    }

    // 4. Fetch tracking from Ecotrack
    const trackingUrl = ECOTRACK_API_URL.replace('/create/order', '/get/tracking/info');
    const etRes = await fetch(`${trackingUrl}?tracking=${trackingId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ECOTRACK_API_TOKEN}`
      }
    });
    
    if (!etRes.ok) {
      return res.status(etRes.status).json({ success: false, error: "Failed to fetch tracking details from delivery provider." });
    }

    const etData = await etRes.json().catch(() => null);

    return res.status(200).json({
      success: true,
      trackingId: trackingId,
      trackingData: etData
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}

async function handlePost(req, res) {
  try {
    const payload = req.body || {};
    
    // Validate required fields
    if (!payload.nom_client || !payload.telephone || !payload.adresse || !payload.commune || !payload.code_wilaya || !payload.montant) {
      return res.status(400).json({ success: false, error: "Missing required Ecotrack fields." });
    }

    if (!ECOTRACK_API_TOKEN) {
      return res.status(500).json({ success: false, error: "ECOTRACK_API_TOKEN is not configured on the server." });
    }

    // 1. Auto-sanitize Phone Number
    let cleanPhone = String(payload.telephone).replace(/\s+/g, ''); 
    if (cleanPhone.startsWith('+213')) cleanPhone = '0' + cleanPhone.substring(4);
    if (cleanPhone.startsWith('00213')) cleanPhone = '0' + cleanPhone.substring(5);
    payload.telephone = cleanPhone;

    // Force "Colis Fragile" and "Poids" flags for all orders
    payload.fragile = 1;
    payload.weight = 2;

    const buildFormParams = (p) => {
      const formParams = new URLSearchParams();
      formParams.append("api_token", ECOTRACK_API_TOKEN);
      for (const [key, value] of Object.entries(p)) {
        formParams.append(key, value);
      }
      return formParams;
    };

    let response = await fetch(ECOTRACK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${ECOTRACK_API_TOKEN}`
      },
      body: buildFormParams(payload)
    });

    let data = await response.json().catch(() => null);

    // 2. Auto-Match Commune if Ecotrack rejects the commune name/wilaya mapping.
    const communeError = !response.ok && response.status === 422 && JSON.stringify(data || "").toLowerCase().includes("commune");
    if (communeError) {
      try {
        const communesUrl = ECOTRACK_API_URL.replace('/create/order', '/get/communes');
        const resComm = await fetch(`${communesUrl}?api_token=${ECOTRACK_API_TOKEN}&wilaya_id=${payload.code_wilaya}`, {
          headers: { "Authorization": `Bearer ${ECOTRACK_API_TOKEN}` }
        });
        const commData = await resComm.json().catch(() => null);

        let correctedCommune = null;
        if (commData && typeof commData === 'object') {
          const targetNorm = normalizeString(payload.commune);
          const items = Array.isArray(commData) ? commData : Object.values(commData);
          const wilayaCommunes = items.filter((c) => c && c.nom && String(c.wilaya_id) === String(payload.code_wilaya));

          // 1) Exact normalized match
          const exact = wilayaCommunes.find((c) => normalizeString(c.nom) === targetNorm);
          if (exact) correctedCommune = exact.nom;

          // 2) Unique partial match (handles minor spelling/spacing differences)
          if (!correctedCommune && targetNorm) {
            const partial = wilayaCommunes.filter((c) => {
              const n = normalizeString(c.nom);
              return n.includes(targetNorm) || targetNorm.includes(n);
            });
            if (partial.length === 1) correctedCommune = partial[0].nom;
          }
        }

        // Retry with corrected commune
        if (correctedCommune) {
          payload.commune = correctedCommune;
          response = await fetch(ECOTRACK_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Bearer ${ECOTRACK_API_TOKEN}`
            },
            body: buildFormParams(payload)
          });
          data = await response.json().catch(() => null);
        } else {
          console.warn("[ecotrack] Commune auto-correction could not find a match", {
            commune: payload.commune,
            code_wilaya: payload.code_wilaya,
          });
        }
      } catch (err) {
        console.error("Commune auto-correction failed", err);
      }
    }

    if (!response.ok) {
      return res.status(400).json({ 
        success: false, 
        error: `Provider API Error (${response.status}): ${data?.message || data?.error || 'Endpoint not found or invalid payload. Check ECOTRACK_API_URL.'}`,
        details: data 
      });
    }

    // Attempt to save tracking ID to Supabase (assuming 'ecotrack_id' column exists)
    if (data && data.tracking) {
      if (SUPABASE_URL && SUPABASE_KEY && payload.reference) {
        await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(payload.reference)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify({ ecotrack_id: data.tracking })
        }).catch(() => null);
      }
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to submit to Ecotrack" });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return await handleGet(req, res);
  } else if (req.method === "POST") {
    return await handlePost(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
};
