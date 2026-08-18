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

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "8737005667:AAGyExL8mgh8YxNaKGjzo6O99IuflmGA5rg";

const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CONTACTS_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID ||
  "-1003790940322";

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

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
    const { name, contact, message } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanContact = String(contact || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanName || !cleanContact || !cleanMessage) {
      return res.status(400).json({ error: "Name, contact, and message are required" });
    }

    const id = Date.now().toString();

    // 1. Insert into Supabase 'contacts' table directly
    if (SUPABASE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            id,
            name: cleanName,
            contact: cleanContact,
            message: cleanMessage,
            created_at: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.warn("Failed to insert contact into Supabase table:", err);
      }
    }

    // 2. Send Telegram notification directly from Vercel backend
    const telegramText =
      `✉️ <b>New Contact Message!</b>\n` +
      `👤 <b>Name:</b> ${cleanName}\n` +
      `📬 <b>Contact:</b> ${cleanContact}\n\n` +
      `💬 <b>Message:</b>\n${cleanMessage}`;

    await sendTelegram(telegramText);

    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to submit contact message" });
  }
};
