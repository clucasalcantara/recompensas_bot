import type { IncomingMessage, ServerResponse } from "node:http";
import { getApp } from "../src/app.js";
import { runDailyReminder } from "../src/scheduler.js";

export const config = { maxDuration: 30 };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.authorization;
  if (!secret || header !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  const { config, store, bot } = await getApp();
  const result = await runDailyReminder({
    config,
    store,
    send: async (chatId, text) => {
      await bot.api.sendMessage(chatId, text);
    },
  });
  res.statusCode = 200;
  res.end(result);
}
