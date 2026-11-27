import assert from "node:assert/strict";
import test from "node:test";
import { acceptClimate, phraseSystem, phraseUser } from "./phrase.js";

test("o clima não carrega número nem conta", () => {
  assert.equal(acceptClimate("Fica perto."), "Fica perto.");
  assert.equal(acceptClimate("Fica perto. E mais uma."), "Fica perto.");
  assert.equal(acceptClimate("Já pode coletar 2 min."), null);
  assert.equal(acceptClimate("Foram 35 min."), null);
  assert.equal(acceptClimate("Olha o saldo."), null);
  assert.match(phraseSystem(), /Nenhum número/);
  assert.doesNotMatch(phraseUser({ speaker: "Caio" }), /\d/);
});
