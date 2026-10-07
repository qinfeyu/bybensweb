const ECOTRACK_API_TOKEN = process.env.ECOTRACK_API_TOKEN || "";
const ECOTRACK_API_URL = process.env.ECOTRACK_API_URL || "https://app.ecotrack.dz/api/v1/create/order";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    
    // Validate required fields
    if (!payload.nom_client || !payload.telephone || !payload.adresse || !payload.commune || !payload.code_wilaya || !payload.montant) {
      return res.status(400).json({ success: false, error: "Missing required Ecotrack fields." });
    }

    if (!ECOTRACK_API_TOKEN) {
      return res.status(500).json({ success: false, error: "ECOTRACK_API_TOKEN is not configured on the server." });
    }

    // Ecotrack often expects application/x-www-form-urlencoded with api_token in the body
    const formParams = new URLSearchParams();
    formParams.append("api_token", ECOTRACK_API_TOKEN);
    for (const [key, value] of Object.entries(payload)) {
      formParams.append(key, value);
    }

    const response = await fetch(ECOTRACK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${ECOTRACK_API_TOKEN}` // Keep Bearer as fallback
      },
      body: formParams
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Changed to 400 so we can distinguish from Vercel's 404
      return res.status(400).json({ 
        success: false, 
        error: `Provider API Error (${response.status}): ${data?.message || data?.error || 'Endpoint not found or invalid payload. Check ECOTRACK_API_URL.'}`,
        details: data 
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to submit to Ecotrack" });
  }
};
