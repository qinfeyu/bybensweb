const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dbezrrzmcosxdoorbrgx.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  Buffer.from("c2Jfc2VjcmV0X05SOTgxcWo2WGdyTGZHQ2M5WmRrWndfNXJ5UUg4bk0=", "base64").toString();

const SB_HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: "return=representation",
};

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
    const { action, table, data, match } = req.body || {};
    if (!table || !action) {
      return res.status(400).json({ error: "Table and action are required" });
    }

    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let method = "POST";
    const headers = { ...SB_HEADERS };

    if (action === "upsert") {
      method = "POST";
      headers["Prefer"] = "resolution=merge-duplicates,return=representation";
    } else if (action === "insert") {
      method = "POST";
    } else if (action === "update") {
      method = "PATCH";
      if (match && typeof match === "object") {
        const queryParams = Object.entries(match)
          .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
          .join("&");
        url += `?${queryParams}`;
      }
    } else if (action === "delete") {
      method = "DELETE";
      if (match && typeof match === "object") {
        const queryParams = Object.entries(match)
          .map(([k, v]) => {
            if (typeof v === "string" && v.startsWith("like:")) {
              return `${k}=like.${encodeURIComponent(v.substring(5))}`;
            }
            return `${k}=eq.${encodeURIComponent(v)}`;
          })
          .join("&");
        url += `?${queryParams}`;
      }
    }

    const opts = { method, headers };
    if (data && (action === "upsert" || action === "insert" || action === "update")) {
      opts.body = JSON.stringify(data);
    }

    const response = await fetch(url, opts);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`Admin mutate error on ${table} [${action}]:`, result);
      return res.status(response.status || 500).json({ error: result.message || result });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
