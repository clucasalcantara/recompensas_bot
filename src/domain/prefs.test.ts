import assert from "node:assert/strict";
import test from "node:test";
import {
  formatKnown,
  learnPreference,
  nextQuestion,
  preferenceBrief,
  resolveAbout,
  type Preference,
} from "./prefs.js";

const names = { giName: "Gi", lucasName: "Caio" };

test("anota gosto e limite de quem falou", () => {
  assert.deepEqual(learnPreference("eu gosto de beijo no pescoço", names), {
    about: "me",
    kind: "gosta",
    note: "beijo no pescoco",
  });
  assert.deepEqual(learnPreference("não quero nada agressivo", names), {
    about: "me",
    kind: "evita",
    note: "nada agressivo",
  });
  assert.deepEqual(learnPreference("a Gi gosta de carinho no cabelo", names), {
    about: "gi",
    kind: "gosta",
    note: "carinho no cabelo",
  });
  assert.equal(learnPreference("oi", names), null);
  assert.equal(learnPreference("cadê você?", names), null);
  assert.equal(resolveAbout("partner", "lucas"), "gi");
});

test("a pergunta seguinte só existe se essa pessoa ainda não respondeu", () => {
  const saved: Preference[] = [
    {
      id: 1,
      userId: 10,
      owner: "lucas",
      about: "lucas",
      kind: "gosta",
      note: "beijo",
      question: "gosta",
    },
  ];
  assert.equal(nextQuestion(saved, 10, "Caio")?.id, "evita");
  assert.equal(nextQuestion([], 10, "Caio")?.id, "gosta");
  assert.match(preferenceBrief(saved, names), /Caio gosta de beijo/);
  assert.match(formatKnown(saved, names), /Caio gosta: beijo/);
  assert.match(preferenceBrief([], names), /nenhuma/);
});
