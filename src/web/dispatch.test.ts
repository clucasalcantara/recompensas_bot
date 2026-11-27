import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStore } from "../memory-store.js";
import { readCookie } from "./auth.js";
import { dispatch, resetGate, type WebConfig, type WebDeps, type WebResult } from "./dispatch.js";

const config: WebConfig = {
  webPassword: "nala&hades",
  lucasName: "Caio",
  giName: "Gi",
  lucasUserId: 1,
  giUserId: 2,
  togetherApiKey: "test",
  togetherModel: "test",
  reminderTimeZone: "UTC",
};

function deps(extra: Partial<WebDeps> = {}): WebDeps {
  return { config, store: createMemoryStore({ giUserId: 2 }), guideFor: async () => null, ...extra };
}

function cookieOf(result: WebResult): string {
  const token = readCookie(result.cookie, "casa");
  assert.ok(token);
  return token;
}

test("entra com a senha, guarda história e o jogo lê isso", async () => {
  resetGate();
  const house = deps();
  const denied = await dispatch(
    {
      method: "POST",
      op: "login",
      cookie: undefined,
      body: { name: "Gi", password: "errada" },
      ip: "a",
      now: 1,
      secure: false,
    },
    house,
  );
  assert.equal(denied.status, 401);

  const login = await dispatch(
    {
      method: "POST",
      op: "login",
      cookie: undefined,
      body: { name: "Gi", password: "nala&hades" },
      ip: "a",
      now: 2,
      secure: false,
    },
    house,
  );
  assert.equal(login.status, 200);
  const cookie = cookieOf(login);
  assert.equal((login.body as { who: string }).who, "gi");

  const saved = await dispatch(
    {
      method: "POST",
      op: "story",
      cookie,
      body: { topic: "jantar", note: "massa com vinho" },
      ip: "a",
      now: 3,
      secure: false,
    },
    house,
  );
  assert.equal(saved.status, 200);
  assert.match(JSON.stringify(saved.body), /massa com vinho/);

  let seen = "";
  const played = await dispatch(
    {
      method: "POST",
      op: "play",
      cookie,
      body: { kind: "dica", heat: 1 },
      ip: "a",
      now: 4,
      secure: false,
    },
    {
      ...house,
      play: async (_kind, _names, client) => {
        seen = client.tastes ?? "";
        return "Dica\nUm jantar lento.";
      },
    },
  );
  assert.equal(played.status, 200);
  assert.match(seen, /massa com vinho/);
  assert.deepEqual(played.body, { title: "Dica", text: "Um jantar lento.", offline: false });
});

test("a escada da Gi fica na conta dela e o prêmio respeita o saldo", async () => {
  resetGate();
  const house = deps();
  const login = await dispatch(
    {
      method: "POST",
      op: "login",
      cookie: undefined,
      body: { name: "Gi", password: "nala&hades" },
      ip: "b",
      now: 10,
      secure: false,
    },
    house,
  );
  const cookie = cookieOf(login);
  const logged = await dispatch(
    {
      method: "POST",
      op: "log",
      cookie,
      body: { minutes: 60, note: "de manhã" },
      ip: "b",
      now: 11,
      secure: false,
    },
    house,
  );
  assert.equal(logged.status, 200);
  const body = logged.body as { gi: { totalMinutes: number; available: number } };
  assert.equal(body.gi.totalMinutes, 60);
  assert.equal(body.gi.available, 5);

  const early = await dispatch(
    {
      method: "POST",
      op: "redeem",
      cookie,
      body: { kind: "massagem", minutes: 6 },
      ip: "b",
      now: 12,
      secure: false,
    },
    house,
  );
  assert.equal(early.status, 400);

  const taken = await dispatch(
    {
      method: "POST",
      op: "redeem",
      cookie,
      body: { kind: "massagem", minutes: 5 },
      ip: "b",
      now: 13,
      secure: false,
    },
    house,
  );
  assert.equal((taken.body as { gi: { available: number } }).gi.available, 0);
});

test("se o modelo falha, o caderno ainda responde", async () => {
  resetGate();
  const house = deps({
    play: async () => {
      throw new Error("sem modelo");
    },
  });
  const login = await dispatch(
    {
      method: "POST",
      op: "login",
      cookie: undefined,
      body: { name: "Caio", password: "nala&hades" },
      ip: "c",
      now: 20,
      secure: false,
    },
    house,
  );
  const played = await dispatch(
    {
      method: "POST",
      op: "night",
      cookie: cookieOf(login),
      body: { kind: "jantar" },
      ip: "c",
      now: 21,
      secure: false,
    },
    {
      ...house,
      rng: () => 0,
      imagine: async () => {
        throw new Error("sem modelo");
      },
    },
  );
  const card = played.body as { title: string; text: string; offline: boolean };
  assert.equal(played.status, 200);
  assert.equal(card.offline, true);
  assert.equal(card.title, "Jantar");
  assert.match(card.text, /Gi/);
});

test("verdade a Gi escreve e o Caio vê, no nível dos dois", async () => {
  resetGate();
  let called = 0;
  const house = deps({
    play: async () => {
      called += 1;
      return "Dica\nNão era pra chamar.";
    },
  });
  const now = 1_700_000_000_000;
  const gi = await dispatch(
    {
      method: "POST",
      op: "login",
      cookie: undefined,
      body: { name: "Gi", password: "nala&hades" },
      ip: "gi",
      now,
      secure: false,
    },
    house,
  );
  const caio = await dispatch(
    {
      method: "POST",
      op: "login",
      cookie: undefined,
      body: { name: "Caio", password: "nala&hades" },
      ip: "caio",
      now,
      secure: false,
    },
    house,
  );
  const giCookie = cookieOf(gi);
  const caioCookie = cookieOf(caio);

  const heat = await dispatch(
    {
      method: "POST",
      op: "heat",
      cookie: giCookie,
      body: { heat: 3 },
      ip: "gi",
      now: now + 1000,
      secure: false,
    },
    house,
  );
  assert.equal((heat.body as { heat: number }).heat, 3);

  const seen = await dispatch(
    {
      method: "POST",
      op: "mesa",
      cookie: caioCookie,
      body: {},
      ip: "caio",
      now: now + 2000,
      secure: false,
    },
    house,
  );
  const table = seen.body as { heat: number; partnerHere: boolean };
  assert.equal(table.heat, 3);
  assert.equal(table.partnerHere, true);

  const opened = await dispatch(
    {
      method: "POST",
      op: "open",
      cookie: giCookie,
      body: { kind: "verdade" },
      ip: "gi",
      now: now + 3000,
      secure: false,
    },
    house,
  );
  const openedBody = opened.body as { phase: string; heat: number; writer: string };
  assert.equal(openedBody.phase, "writing");
  assert.equal(openedBody.heat, 3);
  assert.equal(openedBody.writer, "gi");

  const blocked = await dispatch(
    {
      method: "POST",
      op: "line",
      cookie: caioCookie,
      body: { text: "eu não escrevo essa" },
      ip: "caio",
      now: now + 5000,
      secure: false,
    },
    house,
  );
  assert.equal(blocked.status, 400);

  const sent = await dispatch(
    {
      method: "POST",
      op: "line",
      cookie: giCookie,
      body: { text: "qual beijo você lembra?" },
      ip: "gi",
      now: now + 6000,
      secure: false,
    },
    house,
  );
  const card = sent.body as { phase: string; title: string; text: string };
  assert.equal(card.phase, "card");
  assert.equal(card.title, "Gi pergunta pra Caio");
  assert.equal(card.text, "qual beijo você lembra?");

  const dare = await dispatch(
    {
      method: "POST",
      op: "open",
      cookie: giCookie,
      body: { kind: "desafio" },
      ip: "gi",
      now: now + 7000,
      secure: false,
    },
    house,
  );
  const dareBody = dare.body as { phase: string; writer: string };
  assert.equal(dareBody.phase, "writing");
  assert.equal(dareBody.writer, "gi");
  const written = await dispatch(
    {
      method: "POST",
      op: "line",
      cookie: giCookie,
      body: { text: "dança um minuto comigo" },
      ip: "gi",
      now: now + 9000,
      secure: false,
    },
    house,
  );
  const challenge = written.body as { title: string; text: string; writer: string | null };
  assert.equal(challenge.title, "Desafio pra Caio");
  assert.equal(challenge.text, "dança um minuto comigo");

  const refused = await dispatch(
    {
      method: "POST",
      op: "play",
      cookie: caioCookie,
      body: { kind: "verdade", heat: 1 },
      ip: "caio",
      now: now + 10000,
      secure: false,
    },
    house,
  );
  assert.equal(refused.status, 400);
  assert.equal(called, 0);
});
