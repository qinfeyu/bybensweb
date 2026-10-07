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

async function handleGet(req, res) {
  try {
    const orderId = req.query.orderId || req.query.id;
    const phone = req.query.phone;

    if (!orderId || !phone) {
      return res.status(400).json({ success: false, error: "Order ID and Phone Number are required." });
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
    const orders = await sbRes.json().catch(() => []);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    const order = orders[0];

    // 2. Validate phone number to prevent enumeration
    const cleanInputPhone = phone.replace(/[^0-9]/g, '');
    const cleanDbPhone = (order.phone || "").replace(/[^0-9]/g, '');
    
    if (!cleanInputPhone || !cleanDbPhone || !cleanDbPhone.endsWith(cleanInputPhone.slice(-8))) {
      return res.status(401).json({ success: false, error: "Phone number does not match this order." });
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

    // 2. Auto-Match Commune if 422 "Commune mal écrite"
    if (!response.ok && response.status === 422 && JSON.stringify(data).includes("Commune mal ")) {
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
          for (const c of items) {
            if (c && c.nom && c.wilaya_id == payload.code_wilaya) {
              if (normalizeString(c.nom) === targetNorm) {
                correctedCommune = c.nom;
                break;
              }
            }
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
