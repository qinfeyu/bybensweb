import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZXpycnptY29zeGRvb3Jicmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcxODExOSwiZXhwIjoyMDk1Mjk0MTE5fQ.TJLVdjwyNCKhS0vyFlUnRW6LQLvotuuFqxUj6H2-JGs";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "8597076283:AAEcCim85KCQZQC-5ik4SLXdS8xPvOJg__o";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "-1003790940322";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendTelegram(message: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" }),
    });
  } catch (_) { /* silent */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { name, contact, message } = await req.json();
    const id = Date.now().toString();

    const { error } = await sb.from("contacts").insert({
      id,
      name: String(name || "").trim(),
      contact: String(contact || "").trim(),
      message: String(message || "").trim(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await sendTelegram(
      `✉️ <b>New Contact Message!</b>\n` +
      `👤 ${String(name || "").trim()}\n` +
      `📬 ${String(contact || "").trim()}\n\n` +
      `💬 ${String(message || "").trim()}`
    );

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
