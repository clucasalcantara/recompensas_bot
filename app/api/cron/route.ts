import { getApp } from "../../../src/app.js";
import { runDailyReminder } from "../../../src/scheduler.js";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { config, store, bot } = await getApp();
  const result = await runDailyReminder({
    config,
    store,
    send: async (chatId, text) => {
      await bot.api.sendMessage(chatId, text);
    },
  });
  return new Response(result);
}
