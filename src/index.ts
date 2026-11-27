import "dotenv/config";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { openStore } from "./db.js";
import { startDailyReminder } from "./scheduler.js";

const config = loadConfig();
const store = await openStore(config.databaseUrl);
const bot = createBot(config, store);
const hour = String(config.reminderHour).padStart(2, "0");
const minute = String(config.reminderMinute).padStart(2, "0");

startDailyReminder({
  config,
  store,
  send: async (chatId, text) => {
    await bot.api.sendMessage(chatId, text);
    console.log(`lembrete enviado para ${chatId}`);
  },
});

await bot.api.setMyCommands([
  { command: "escada", description: "Lançar minutos de escada" },
  { command: "saldo", description: "Ver banco e prêmios" },
  { command: "coletar", description: "Coletar massagem ou boquete" },
  { command: "massagem", description: "Coletar a massagem da Gi" },
  { command: "boquete", description: "Coletar o boquete" },
  { command: "ranking", description: "Quem lançou mais escada" },
  { command: "historico", description: "Últimos lançamentos" },
  { command: "dica", description: "Uma dica de intimidade" },
  { command: "brincadeira", description: "Uma brincadeira pra vocês" },
  { command: "jogo", description: "Ver os joguinhos" },
  { command: "dado", description: "Rolar o dado" },
  { command: "verdade", description: "Uma pergunta íntima" },
  { command: "desafio", description: "Um desafio leve" },
  { command: "desfazer", description: "Desfazer o último lançamento" },
  { command: "regras", description: "Como a conta funciona" },
]);

console.log(`lembrete diário às ${hour}:${minute} (${config.reminderTimeZone})`);

await bot.start({
  onStart: (me) => {
    console.log(`@${me.username} no ar`);
  },
});
