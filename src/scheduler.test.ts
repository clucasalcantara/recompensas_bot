import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "./config.js";
import { forPg } from "./db.js";
import { balances } from "./domain/ledger.js";
import { createMemoryStore } from "./memory-store.js";
import { formatBalance, formatHistory } from "./messages.js";
import { runDailyReminder } from "./scheduler.js";

const names = { giName: "Gi", lucasName: "Lucas" };

test("a conexão tira o channel binding e o pooler na migração", () => {
  const raw =
    "postgresql://user:secret@ep-test-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const direct = forPg(raw, true);
  assert.equal(direct.includes("channel_binding"), false);
  assert.equal(direct.includes("-pooler"), false);
  assert.match(direct, /sslmode=verify-full/);
  assert.match(direct, /ep-test\.c-3/);
  assert.equal(forPg(raw).includes("-pooler"), true);
});

test("saldo e histórico vazios explicam como começar", () => {
  const saldo = formatBalance(names, balances([], []));
  assert.match(saldo, /Ainda não tem escada/);
  assert.doesNotMatch(saldo, /ganhou 0/);

  const historico = formatHistory([], "America/Sao_Paulo");
  assert.match(historico, /Nada lançado ainda/);
  assert.match(historico, /Esteira/);
});

test("o lembrete sai uma vez no chat em que alguém falou", async () => {
  const store = createMemoryStore();
  const config = {
    token: "test",
    allowedUserIds: [1],
    giName: "Gi",
    lucasName: "Lucas",
    databaseUrl: "postgres://unused",
    togetherApiKey: "test",
    togetherModel: "test-model",
    reminderHour: 9,
    reminderMinute: 0,
    reminderTimeZone: "America/Sao_Paulo",
    reminderChatId: null,
  } satisfies Config;
  const sent: string[] = [];
  const send = async (chatId: number, text: string) => {
    sent.push(`${chatId}:${text}`);
  };
  const run = (now: string) =>
    runDailyReminder({
      config,
      store,
      send,
      now: new Date(now),
      lines: async (kind) => (kind === "dica" ? "fica perto" : "beija devagar"),
    });

  assert.equal(await run("2026-11-26T13:00:00.000Z"), "no-chat");
  await store.rememberChat(-100);
  assert.equal(await run("2026-11-26T11:00:00.000Z"), "skipped");
  assert.equal(await run("2026-11-26T13:00:00.000Z"), "sent");
  assert.match(sent[0] ?? "", /fica perto/);
  assert.match(sent[0] ?? "", /beija devagar/);
  assert.equal(await run("2026-11-26T18:00:00.000Z"), "skipped");
});
