import { Bot } from "grammy";
import { createBot } from "./bot.js";
import { BOT_COMMANDS } from "./commands.js";
import { loadConfig, type Config } from "./config.js";
import { openStore } from "./db.js";
import type { Store } from "./store.js";

export type App = {
  config: Config;
  store: Store;
  bot: Bot;
};

let starting: Promise<App> | null = null;

export function getApp(): Promise<App> {
  starting ??= startApp();
  return starting;
}

async function startApp(): Promise<App> {
  const config = loadConfig();
  const store = await openStore(config.databaseUrl, { giUserId: config.giUserId });
  const bot = createBot(config, store);
  await bot.api.setMyCommands([...BOT_COMMANDS]);
  await bot.init();
  return { config, store, bot };
}
