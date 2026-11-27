import assert from "node:assert/strict";
import test from "node:test";
import { helloLine, understand } from "./talk.js";

test("frase solta lança escada, saldo, coleta e clima", () => {
  assert.equal(understand("fiz 40 min de escada").type, "stairs");
  assert.deepEqual(understand("30 de bike"), { type: "stairs-error", error: "rejected" });
  assert.equal(understand("quanto a gente tem?").type, "balance");
  assert.equal(understand("como tá o saldo").type, "balance");
  assert.equal(understand("histórico").type, "history");
  assert.equal(understand("quem subiu mais").type, "ranking");
  assert.equal(understand("como funciona").type, "rules");
  assert.equal(understand("errei, desfaz").type, "undo");
  assert.deepEqual(understand("coleta a massagem"), { type: "collect", raw: "massagem" });
  assert.deepEqual(understand("pega 4 de mamadinha"), { type: "collect", raw: "boquete 4" });
  assert.deepEqual(understand("coleta 2 ciclos de massagem"), {
    type: "collect",
    raw: "massagem 2 ciclos",
  });
  assert.deepEqual(understand("quero coletar"), { type: "collect", raw: "" });
  assert.deepEqual(understand("me dá uma dica"), { type: "play", kind: "dica" });
  assert.deepEqual(understand("cara ou coroa"), { type: "coin" });
  assert.deepEqual(understand("moeda eu cara nivel 2", { giName: "Gi", lucasName: "Caio" }), {
    type: "coin",
    cara: "me",
    heat: 2,
  });
  assert.deepEqual(understand("verdade 3"), { type: "play", kind: "verdade", heat: 3 });
  assert.deepEqual(understand("desafio leve"), { type: "play", kind: "desafio", heat: 1 });
  assert.deepEqual(understand("eu gosto de beijo no pescoço", { giName: "Gi", lucasName: "Caio" }), {
    type: "preference",
    learned: { about: "me", kind: "gosta", note: "beijo no pescoco" },
  });
  assert.equal(understand("me pergunta").type, "calibrate");
  assert.equal(understand("pergunta pra Gi", { giName: "Gi", lucasName: "Caio" }).type, "ask-partner");
  assert.equal(understand("Oi!").type, "hello");
  assert.equal(understand("oi, tudo bem?").type, "hello");
  assert.equal(understand("cadê você?").type, "chat");
  assert.equal(helloLine("Oi!", "Caio"), "Oi, Caio.");
  assert.equal(helloLine("boa noite", "Caio"), "Boa noite, Caio.");
});
