import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZXpycnptY29zeGRvb3Jicmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcxODExOSwiZXhwIjoyMDk1Mjk0MTE5fQ.TJLVdjwyNCKhS0vyFlUnRW6LQLvotuuFqxUj6H2-JGs";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { action, email, password, uid } = await req.json();

    if (action === "list") {
      const { data, error } = await sb.auth.admin.listUsers();
      if (error) return Response.json({ success: false, error: error.message }, { headers: cors });
      const users = data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }));
      return Response.json({ success: true, users }, { headers: cors });
    }

    if (action === "create") {
      if (!email || !password) return Response.json({ success: false, error: "Email and password required" }, { headers: cors });
      if (password.length < 6) return Response.json({ success: false, error: "Password must be at least 6 characters" }, { headers: cors });
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return Response.json({ success: false, error: error.message }, { headers: cors });
      return Response.json({ success: true, user: { id: data.user.id, email: data.user.email, created_at: data.user.created_at } }, { headers: cors });
    }

    if (action === "delete") {
      if (!uid) return Response.json({ success: false, error: "User ID required" }, { headers: cors });
      const { error } = await sb.auth.admin.deleteUser(uid);
      if (error) return Response.json({ success: false, error: error.message }, { headers: cors });
      return Response.json({ success: true }, { headers: cors });
    }

    return Response.json({ success: false, error: "Unknown action" }, { headers: cors });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { headers: cors, status: 500 });
  }
});
