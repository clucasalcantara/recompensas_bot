import dotenv from "dotenv";

dotenv.config({ override: true });

const token = process.env.BOT_TOKEN?.trim();
const url = process.env.WEBHOOK_URL?.trim();
const secret = process.env.WEBHOOK_SECRET?.trim();

if (!token || !url || !secret) {
  throw new Error("Precisa de BOT_TOKEN, WEBHOOK_URL e WEBHOOK_SECRET.");
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  }),
});

const body = (await response.json()) as { ok?: boolean; description?: string };
if (!body.ok) throw new Error(body.description ?? "Não registrei o webhook.");
console.log("Webhook registrado.");
