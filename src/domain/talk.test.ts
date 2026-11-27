import assert from "node:assert/strict";
import test from "node:test";
import { helloLine } from "./talk.js";

test("oi continua oi, sem relatório", () => {
  assert.equal(helloLine("Oi!", "Caio"), "Oi, Caio.");
  assert.equal(helloLine("boa noite", "Caio"), "Boa noite, Caio.");
});
