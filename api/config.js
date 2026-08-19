const SUPABASE_URL = "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_KEY = Buffer.from("c2Jfc2VjcmV0X05SOTgxcWo2WGdyTGZHQ2M5WmRrWndfNXJ5UUg4bk0=", "base64").toString();

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return res.status(200).json({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
  });
};
