import { webhookCallback } from "grammy";
import { getApp } from "../../../src/app.js";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response("ok");
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) return new Response("sem segredo", { status: 500 });
  const { bot } = await getApp();
  return webhookCallback(bot, "std/http", { secretToken: secret })(req);
}
