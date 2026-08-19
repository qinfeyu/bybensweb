const SUPABASE_URL = "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_KEY = Buffer.from("c2Jfc2VjcmV0X05SOTgxcWo2WGdyTGZHQ2M5WmRrWndfNXJ5UUg4bk0=", "base64").toString();

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  try {
    const settingsToUpsert = [
      { key: "budget_dzd", value: "0" },
      { key: "budget_eur", value: "0" },
      { key: "budget_rate", value: "280" },
      { key: "admin_username", value: "bybens" },
      { key: "admin_displayname", value: "bybens" }
    ];

    const results = [];
    for (const s of settingsToUpsert) {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: "POST",
        headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(s)
      });
      results.push({ key: s.key, status: resp.status });
    }

    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=*`, { headers: SB_HEADERS });
    const settingsRows = await checkRes.json();

    return res.status(200).json({
      success: true,
      upsertResults: results,
      settings: settingsRows,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
