import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZXpycnptY29zeGRvb3Jicmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcxODExOSwiZXhwIjoyMDk1Mjk0MTE5fQ.TJLVdjwyNCKhS0vyFlUnRW6LQLvotuuFqxUj6H2-JGs";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { action, email, password, firstName, lastName, phone, address } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (action === "login") {
      const { data: rows, error } = await sb
        .from("customers")
        .select("first_name, last_name, email, phone, address")
        .eq("email", cleanEmail)
        .eq("password", password || "")
        .limit(1);

      if (error || !rows || rows.length === 0) {
        return json({ success: false, error: "Invalid email or password" });
      }

      const u = rows[0];
      return json({
        success: true,
        user: {
          firstName: u.first_name,
          lastName: u.last_name,
          email: u.email,
          phone: u.phone,
          address: u.address,
        },
      });
    }

    if (action === "register") {
      const { data: existing } = await sb
        .from("customers")
        .select("id")
        .eq("email", cleanEmail)
        .limit(1);

      if (existing && existing.length > 0) {
        return json({ success: false, error: "Email already registered" });
      }

      const { error } = await sb.from("customers").insert({
        id: "CUS-" + Date.now(),
        first_name: String(firstName || "").trim(),
        last_name: String(lastName || "").trim(),
        email: cleanEmail,
        password: String(password || ""),
        phone: String(phone || "").trim(),
        address: String(address || "").trim(),
        created_at: new Date().toISOString(),
      });

      if (error) return json({ success: false, error: error.message });
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ success: false, error: e.message }, 500);
  }
});
