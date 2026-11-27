import assert from "node:assert/strict";
import test from "node:test";
import { directedHeat, planTurn } from "./scene.js";
import { parseAgent } from "./reason.js";
import { userPrompt } from "../suggest.js";

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
});
