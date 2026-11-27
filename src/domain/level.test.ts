import assert from "node:assert/strict";
import test from "node:test";
import { LIBRARY, directionFor, rankContent } from "./library.js";
import { directedHeat } from "./scene.js";
import { planTurn } from "./scene.js";
import { parseAgent } from "./reason.js";
import { userPrompt } from "../suggest.js";

test("emoção funda cabe no 1 e no 2, e o 3 fica sexual", () => {
  const level1 = rankContent(LIBRARY, { level: 1 });
  assert.ok(level1.some((item) => item.emotionalDepth === "deep" && item.sexualContent === "none"));
  assert.ok(level1.every((item) => item.sexualContent === "none"));

  const level2 = rankContent(LIBRARY, { level: 2 });
  assert.ok(level2.some((item) => item.emotionalDepth === "deep" && item.sexualContent === "none"));
  assert.ok(level2.every((item) => item.sexualContent !== "explicit"));

  const level3 = rankContent(LIBRARY, { level: 3 });
  assert.ok(level3.length > 0);
  assert.ok(level3.every((item) => item.sexualContent === "explicit"));
  assert.equal(level3.some((item) => item.id === "fundo-sem-sexo"), false);
  assert.equal(level3[0]?.sexualContent, "explicit");
});

test("profundidade não sobe a cena para o quente", () => {
  assert.equal(directedHeat({ text: "tenho medo de te perder", current: 2, proposed: 3 }), 2);
  assert.equal(directedHeat({ text: "verdade", current: null, proposed: 3 }), 2);
  assert.equal(directedHeat({ text: "verdade quente", current: 2, proposed: 2 }), 3);
  assert.equal(directedHeat({ text: "outra", current: 3 }), 3);

  const plan = planTurn({
    text: "me conta uma insegurança",
    place: "group",
    speaker: "lucas",
    speakerName: "Caio",
    addressed: true,
    scene: { heat: 2, kind: "verdade" },
    choice: parseAgent('{"action":"play","kind":"verdade","heat":3,"scene":"continue"}'),
  });
  assert.equal(plan.scene?.heat, 2);

  const stopped = planTurn({
    text: "para",
    place: "group",
    speaker: "gi",
    speakerName: "Gi",
    addressed: true,
    scene: { heat: 3, kind: "desafio" },
    choice: parseAgent('{"action":"play","kind":"desafio","heat":3}'),
  });
  assert.equal(stopped.reply, "stop");
  assert.equal(stopped.scene, null);
});

test("o pedido do nível 2 não pede explícito e o 3 pede sexo", () => {
  const names = { giName: "Gi", lucasName: "Caio" };
  const medium = userPrompt({ names, kind: "verdade", tone: "misto", heat: 2, seed: "a" });
  const hot = userPrompt({ names, kind: "verdade", tone: "sexual", heat: 3, seed: "a" });
  assert.match(medium, /Sem sexo explícito/);
  assert.doesNotMatch(medium, /Direção sexual de propósito/);
  assert.match(hot, /Direção sexual de propósito/);
  assert.match(directionFor(3, "verdade") ?? "", /fantasia sexual/);
  assert.equal(directionFor(1, "verdade")?.includes("infância") || directionFor(1, "verdade")?.includes("infancia"), true);
});
