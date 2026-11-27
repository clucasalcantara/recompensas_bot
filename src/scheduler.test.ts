import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "./config.js";
import { forPg } from "./db.js";
import { balances } from "./domain/ledger.js";
import { createMemoryStore } from "./memory-store.js";
import { formatBalance, formatHistory, formatRules } from "./messages.js";
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

test("as regras explicam a conta sem lista de comando", () => {
  const rules = formatRules(names);
  assert.match(rules, /Só vale escada/);
  assert.match(rules, /sem cobrar o prêmio/);
  assert.doesNotMatch(rules, /\//);
  assert.doesNotMatch(rules, /fiz 40/);
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
    lucasUserId: 1,
    giUserId: 2,
    databaseUrl: "postgres://unused",
    togetherApiKey: "test",
    togetherModel: "test-model",
    reminderHour: 16,
    reminderMinute: 0,
    reminderTimeZone: "America/Sao_Paulo",
    reminderChatId: null,
    groupChatId: null,
    groupsEnabled: true,
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
    });

  assert.equal(await run("2026-11-26T19:00:00.000Z"), "no-chat");
  await store.rememberChat(-100);
  assert.equal(await run("2026-11-26T18:00:00.000Z"), "skipped");
  assert.equal(await run("2026-11-26T19:00:00.000Z"), "sent");
  assert.match(sent[0] ?? "", /ainda não começou/);
  assert.doesNotMatch(sent[0] ?? "", /Dica/);
  assert.doesNotMatch(sent[0] ?? "", /coletar/);
  assert.equal(await run("2026-11-26T22:00:00.000Z"), "skipped");
});
