import assert from "node:assert/strict";
import test from "node:test";
import { balances } from "./ledger.js";
import { formatLog } from "../messages.js";
import { parseAgent, type AgentChoice } from "./reason.js";
import { shouldSendReminder } from "./reminder.js";
import { planTurn, type Scene } from "./scene.js";
import { createMemoryStore } from "../memory-store.js";

function choice(body: Record<string, unknown>): AgentChoice {
  const parsed = parseAgent(JSON.stringify(body));
  if (!parsed) throw new Error(`decisão inválida: ${JSON.stringify(body)}`);
  return parsed;
}

const open: Scene = { heat: 2, kind: "verdade" };

test("oi no grupo, sem marcação, não responde", () => {
  const plan = planTurn({
    text: "Oi",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: false,
    scene: null,
    choice: choice({ action: "hello", say: "Oi, Caio." }),
  });
  assert.equal(plan.reply, "quiet");
  assert.equal(plan.text, null);
});

test("conversa solta no grupo fica guardada e sem resposta", async () => {
  const store = createMemoryStore();
  await store.addMessage({ chatId: -1, userId: 1, name: "Caio", role: "user", text: "vamos pedir pizza" });
  const plan = planTurn({
    text: "vamos pedir pizza",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: false,
    scene: open,
    choice: choice({ action: "chat", say: "Boa." }),
  });
  assert.equal(plan.reply, "quiet");
  assert.deepEqual(plan.scene, open);
  assert.deepEqual(await store.recentMessages(-1, 5), [
    { name: "Caio", role: "user", text: "vamos pedir pizza" },
  ]);
});

test("marcação responde, e resposta ao bot continua a cena", () => {
  const mentioned = planTurn({
    text: "oi",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: choice({ action: "chat", say: "Oi, Caio.", recipient: "speaker" }),
  });
  assert.equal(mentioned.text, "Oi, Caio.");
  assert.equal(mentioned.recipient, "speaker");

  const replied = planTurn({
    text: "continua",
    place: "group",
    speaker: "gi",
    speakerName: "Gi",
    addressed: true,
    scene: open,
    choice: choice({ action: "chat", say: "Segue.", scene: "continue" }),
  });
  assert.equal(replied.text, "Segue.");
  assert.deepEqual(replied.scene, open);
});

test("o que o Caio diz da Gi não vira preferência dela", () => {
  const plan = planTurn({
    text: "a Gi gosta de beijo no pescoço",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: choice({
      action: "preference",
      about: "partner",
      kind: "gosta",
      note: "beijo no pescoco",
      invite: "então beija ela agora",
    }),
  });
  assert.deepEqual(plan.savePreference, {
    owner: "lucas",
    about: "gi",
    kind: "gosta",
    note: "beijo no pescoco",
  });
  assert.notEqual(plan.savePreference?.owner, plan.savePreference?.about);
  assert.equal(plan.reply, "quiet");
  assert.equal(plan.invite, null);
});

test("o que a Gi diz de si vale como dela", () => {
  const plan = planTurn({
    text: "eu gosto de beijo no pescoço",
    place: "group",
    speaker: "gi",
    speakerName: "Gi",
    addressed: true,
    scene: null,
    choice: choice({ action: "preference", about: "me", kind: "gosta", note: "beijo no pescoco" }),
  });
  assert.deepEqual(plan.savePreference, {
    owner: "gi",
    about: "gi",
    kind: "gosta",
    note: "beijo no pescoco",
  });
  assert.equal(plan.reply, "quiet");
});

test("verdade abre no nível 2 e o desafio seguinte continua nele", () => {
  const first = planTurn({
    text: "verdade",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: choice({ action: "play", kind: "verdade" }),
  });
  assert.equal(first.reply, "ledger");
  assert.deepEqual(first.scene, { heat: 2, kind: "verdade" });

  const next = planTurn({
    text: "desafio",
    place: "group",
    speaker: "gi",
    speakerName: "Gi",
    addressed: true,
    scene: first.scene,
    choice: choice({ action: "play", kind: "desafio", scene: "continue" }),
  });
  assert.deepEqual(next.scene, { heat: 2, kind: "desafio" });
});

test("mudar de assunto fecha a cena, e para corta mesmo se o modelo quiser continuar", () => {
  const changed = planTurn({
    text: "como estão os saldos",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: open,
    choice: choice({ action: "balance", scope: "both", scene: "end" }),
  });
  assert.equal(changed.scene, null);
  assert.equal(changed.reply, "ledger");

  const stopped = planTurn({
    text: "para",
    place: "group",
    speaker: "gi",
    speakerName: "Gi",
    addressed: false,
    scene: open,
    choice: choice({ action: "play", kind: "verdade", heat: 3 }),
  });
  assert.equal(stopped.reply, "stop");
  assert.equal(stopped.text, "Parou.");
  assert.equal(stopped.scene, null);
});

test("preferência nova não vira convite, e papo comum também não", () => {
  const taste = planTurn({
    text: "eu gosto de ficar perto",
    place: "private",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: choice({ action: "preference", about: "me", kind: "gosta", note: "ficar perto", invite: "vamos jogar" }),
  });
  assert.equal(taste.invite, null);
  assert.equal(taste.reply, "quiet");

  const cold = planTurn({
    text: "que horas você dorme?",
    place: "private",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: choice({ action: "chat", say: "Tarde.", invite: "bora uma verdade" }),
  });
  assert.equal(cold.invite, null);
  assert.equal(cold.text, "Tarde.");

  const warm = planTurn({
    text: "continua",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: open,
    choice: choice({ action: "chat", say: "Perto.", invite: "fica mais perto" }),
  });
  assert.equal(warm.invite, "fica mais perto");
  const pushed = planTurn({
    text: "continua",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: open,
    choice: choice({ action: "chat", say: "Perto.", invite: "já pode coletar" }),
  });
  assert.equal(pushed.invite, null);
});

test("+25 grava a escada mesmo se o modelo só responder beleza", () => {
  const plan = planTurn({
    text: "+25",
    place: "group",
    speaker: "gi",
    speakerName: "Gi",
    addressed: true,
    scene: open,
    choice: choice({ action: "chat", say: "Mais 25, beleza!" }),
  });
  assert.equal(plan.reply, "ledger");
  assert.equal(plan.scene, null);
  assert.deepEqual(plan.decision, { action: "stairs", minutes: 25, note: null });
});

test("escada soma na pessoa certa e o prêmio novo não cobra", () => {
  const plan = planTurn({
    text: "+35",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: false,
    scene: open,
    choice: choice({ action: "stairs", minutes: 35 }),
  });
  assert.equal(plan.reply, "ledger");
  assert.equal(plan.recipient, "speaker");
  assert.equal(plan.scene, null);

  const before = balances([{ minutes: 40, owner: "lucas" }], []);
  const after = balances(
    [
      { minutes: 40, owner: "lucas" },
      { minutes: 35, owner: "lucas" },
    ],
    [],
  );
  const log = formatLog({
    config: { giName: "Gi", lucasName: "Caio" },
    minutes: 35,
    note: null,
    owner: "lucas",
    before,
    after,
  });
  assert.match(log, /Caio, 35 min/);
  assert.match(log, /já pode coletar 2 min/);
  assert.doesNotMatch(log, /mamadinha|é só coletar|estão devendo/);
  assert.equal(after.lucas.bankMinutes, 15);
  assert.equal(after.gi.totalMinutes, 0);

  const quiet = formatLog({
    config: { giName: "Gi", lucasName: "Caio" },
    minutes: 20,
    note: null,
    owner: "gi",
    before: balances([], []),
    after: balances([{ minutes: 20, owner: "gi" }], []),
  });
  assert.doesNotMatch(quiet, /já pode coletar/);
});

test("fala só com quem entrou, e a Gi no privado volta pro grupo", () => {
  const onlyCaio = planTurn({
    text: "quantos minutos eu tenho",
    place: "private",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: choice({ action: "balance", scope: "me", recipient: "both" }),
  });
  assert.equal(onlyCaio.recipient, "speaker");

  const gi = planTurn({
    text: "saldo",
    place: "private",
    speaker: "gi",
    speakerName: "Gi",
    addressed: true,
    scene: open,
    choice: choice({ action: "balance", scope: "both" }),
  });
  assert.match(gi.text ?? "", /ficam no grupo/);
  assert.deepEqual(gi.scene, open);
});

test("o lembrete de Vancouver continua às 16h", () => {
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T17:00:00.000Z"),
      timeZone: "America/Vancouver",
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-27T00:00:00.000Z"),
      timeZone: "America/Vancouver",
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    true,
  );
});

test("decisão vazia não pede pra repetir e o mesmo update entra uma vez", async () => {
  const plan = planTurn({
    text: "tudo bem por aí?",
    place: "private",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: null,
    choice: null,
  });
  assert.equal(plan.reply, "model");
  assert.equal(plan.text, null);

  const store = createMemoryStore();
  assert.equal(await store.claimUpdate(10), true);
  assert.equal(await store.claimUpdate(10), false);
  assert.equal(await store.claimUpdate(11), true);
});

test("a cena gravada volta inteira e o papo recente não leva o arquivo todo", async () => {
  const store = createMemoryStore();
  await store.setScene(-1, { heat: 3, kind: "desafio" });
  assert.deepEqual(await store.getScene(-1), { heat: 3, kind: "desafio" });
  await store.setScene(-1, null);
  assert.equal(await store.getScene(-1), null);
  for (let index = 0; index < 20; index += 1) {
    await store.addMessage({ chatId: -1, userId: 1, name: "Caio", role: "user", text: `fala ${index}` });
  }
  const recent = await store.recentMessages(-1, 12);
  assert.equal(recent.length, 12);
  assert.equal(recent[0]?.text, "fala 8");
  assert.equal(recent.at(-1)?.text, "fala 19");
});
