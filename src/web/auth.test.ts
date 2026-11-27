import assert from "node:assert/strict";
import test from "node:test";
import { passwordOk, readCookie, readSession, signSession, whoByName } from "./auth.js";
import { houseUrl } from "./url.js";

test("a senha e a sessão da casa", () => {
  assert.equal(passwordOk("nala&hades", "nala&hades"), true);
  assert.equal(passwordOk("nala", "nala&hades"), false);
  assert.equal(passwordOk("", "segredo"), false);

  const token = signSession("gi", "segredo", 1_000);
  assert.equal(readSession(token, "segredo", 1_000), "gi");
  assert.equal(readSession(`${token}x`, "segredo", 1_000), null);
  assert.equal(readSession(token, "outra", 1_000), null);
  assert.equal(readSession(token, "segredo", 1_000 + 40 * 24 * 60 * 60 * 1000), null);
  assert.equal(readCookie(`casa=${token}; HttpOnly`, "casa"), token);
});

test("o nome escolhe quem entrou", () => {
  const names = { lucasName: "Caio", giName: "Gi" };
  assert.equal(whoByName(" gi ", names), "gi");
  assert.equal(whoByName("CAIO", names), "lucas");
  assert.equal(whoByName("Lucas", names), null);
});

test("o endereço da casa sai do webhook", () => {
  assert.equal(houseUrl("https://bot-mozis.kreatives.io/api/telegram"), "https://bot-mozis.kreatives.io");
  assert.equal(houseUrl("não é url"), null);
  assert.equal(houseUrl("  "), null);
});
