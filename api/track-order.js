const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const ECOTRACK_API_TOKEN = process.env.ECOTRACK_API_TOKEN || "";
const ECOTRACK_API_URL = process.env.ECOTRACK_API_URL || "https://app.ecotrack.dz/api/v1/create/order";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
    // (Strip formatting to compare reliably)
    const cleanInputPhone = phone.replace(/[^0-9]/g, '');
    const cleanDbPhone = (order.phone || "").replace(/[^0-9]/g, '');
    
    // We allow a match if the last 8 digits match, to handle +213 vs 0 prefixes easily
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
};
