import assert from "node:assert/strict";
import test from "node:test";
import { parseCollect, parseRedeem, parseStairs } from "./parse.js";

test("comando de escada aceita minutos, hora e nota", () => {
  assert.deepEqual(parseStairs("40", true), {
    type: "stairs",
    minutes: 40,
    note: null,
  });
  assert.deepEqual(parseStairs("1h30", true), {
    type: "stairs",
    minutes: 90,
    note: null,
  });
  assert.deepEqual(parseStairs("1:20 hotel", true), {
    type: "stairs",
    minutes: 80,
    note: "hotel",
  });
  assert.deepEqual(parseStairs("40 hotel", true), {
    type: "stairs",
    minutes: 40,
    note: "hotel",
  });
  assert.equal(parseStairs("", true).type, "need-minutes");
  assert.equal(parseStairs("0", true).type, "invalid");
  assert.equal(parseStairs("300", true).type, "too-long");
});

test("texto solto só conta se for escada", () => {
  assert.deepEqual(parseStairs("fiz 40 min de escada no predio", false), {
    type: "stairs",
    minutes: 40,
    note: "no predio",
  });
  assert.equal(parseStairs("30 esteira", false).type, "rejected");
  assert.equal(parseStairs("30 de bike", false).type, "rejected");
  assert.equal(parseStairs("40", false).type, "ignore");
  assert.equal(parseStairs("escada", false).type, "need-minutes");
  assert.equal(parseStairs("bora escada amanha", false).type, "ignore");
  assert.equal(parseStairs("19:40 escada 30", false).type, "ambiguous");
});

test("resgate pede o prêmio e os minutos", () => {
  assert.deepEqual(parseRedeem("massagem 5"), {
    ok: true,
    kind: "massagem",
    minutes: 5,
  });
  assert.deepEqual(parseRedeem("boquete 2"), {
    ok: true,
    kind: "boquete",
    minutes: 2,
  });
  assert.deepEqual(parseRedeem("5"), { ok: false, reason: "usage" });
});

test("coleta aceita tudo, uma parte, ou o prêmio assumido", () => {
  assert.deepEqual(parseCollect(""), { ok: false, reason: "menu" });
  assert.deepEqual(parseCollect("massagem"), { ok: true, kind: "massagem", minutes: "all" });
  assert.deepEqual(parseCollect("boquete 2"), { ok: true, kind: "boquete", minutes: 2 });
  assert.deepEqual(parseCollect("", "massagem"), { ok: true, kind: "massagem", minutes: "all" });
  assert.deepEqual(parseCollect("5", "massagem"), { ok: true, kind: "massagem", minutes: 5 });
  assert.equal(parseCollect("0", "boquete").ok, false);
});
