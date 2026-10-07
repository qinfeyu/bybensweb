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

    const response = await fetch(ECOTRACK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ECOTRACK_API_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: data?.message || data?.error || `Ecotrack API Error: ${response.status}`,
        details: data 
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to submit to Ecotrack" });
  }
};
