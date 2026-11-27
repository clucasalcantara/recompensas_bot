import type { IncomingMessage, ServerResponse } from "node:http";
import { webhookCallback } from "grammy";
import { getApp } from "../src/app.js";

export const config = { maxDuration: 30 };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }

  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.statusCode = 500;
    res.end("sem segredo");
    return;
  }

  const { bot } = await getApp();
  await webhookCallback(bot, "http", { secretToken: secret })(req, res);
}
