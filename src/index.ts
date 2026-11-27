import dotenv from "dotenv";

dotenv.config({ override: true });
import { getApp } from "./app.js";
import { startDailyReminder } from "./scheduler.js";

const { config, store, bot } = await getApp();
const hour = String(config.reminderHour).padStart(2, "0");
const minute = String(config.reminderMinute).padStart(2, "0");
console.log(
  `liberados: ${config.allowedUserIds.length} · grupos: ${config.groupsEnabled ? "sim" : "não"}`,
);

const stopReminder = startDailyReminder({
  config,
  store,
  send: async (chatId, text) => {
    try {
      await bot.api.sendMessage(chatId, text);
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);
      if (description.includes("chat not found")) {
        const meName = bot.botInfo?.username ?? "o bot";
        throw new Error(
          `Lembrete não saiu. O id ${chatId} não é um chat deste bot. Adiciona @${meName} no grupo e manda /start lá.`,
        );
      }
      throw error;
    }
    console.log(`lembrete enviado para ${chatId}`);
  },
});

console.log(`lembrete diário às ${hour}:${minute} (${config.reminderTimeZone})`);

await bot.start({
  onStart: (me) => {
    console.log(`@${me.username ?? "o bot"} no ar`);
  },
});

stopReminder();
