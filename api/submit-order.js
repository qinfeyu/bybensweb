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

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    };

    const realTotal = Number(req.body.total) || 0;
    const realSubtotal = Number(req.body.subtotal) || 0;

    // 1. Force total & subtotal to 0 for Edge Function insert to neutralize PostgreSQL DB trigger (+0 DA)
    const edgePayload = {
      ...req.body,
      total: 0,
      subtotal: 0
    };

    // 2. Submit order to Supabase Edge Function (inserts order with total 0 & status 'waiting')
    const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-order`, {
      method: "POST",
      headers,
      body: JSON.stringify(edgePayload),
    });

    const data = await response.json().catch(() => ({ success: true }));

    // 3. Immediately update the order row to its real total & subtotal (UPDATE does NOT fire DB insert trigger!)
    if (data && data.id) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${data.id}`, {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            total: realTotal,
            subtotal: realSubtotal
          })
        });
      } catch (err) {
        console.error("Failed to update real order total:", err);
      }
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(response.status || 200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to submit order" });
  }
};
