import assert from "node:assert/strict";
import test from "node:test";
import { balances, redeemError, undoSessionError } from "./ledger.js";

test("minutos abaixo de 60 ficam no banco de quem subiu", () => {
  const result = balances([{ minutes: 45, owner: "lucas" }], []);

  assert.equal(result.lucas.cycles, 0);
  assert.equal(result.lucas.bankMinutes, 45);
  assert.equal(result.lucas.minutesToNextCycle, 15);
  assert.equal(result.massagem.available, 0);
  assert.equal(result.boquete.available, 0);
});

test("cada um resgata só da própria escada", () => {
  const result = balances(
    [
      { minutes: 75, owner: "lucas" },
      { minutes: 120, owner: "gi" },
    ],
    [{ kind: "massagem", minutes: 10 }],
  );

  assert.equal(result.lucas.totalMinutes, 75);
  assert.equal(result.lucas.cycles, 1);
  assert.equal(result.lucas.bankMinutes, 15);
  assert.deepEqual(result.boquete, { earned: 2, spent: 0, available: 2 });
  assert.equal(result.gi.totalMinutes, 120);
  assert.equal(result.gi.bankMinutes, 0);
  assert.deepEqual(result.massagem, { earned: 10, spent: 10, available: 0 });
});

test("a escada do lucas não gera massagem", () => {
  const result = balances([{ minutes: 75, owner: "lucas" }], []);

  assert.equal(result.gi.totalMinutes, 0);
  assert.equal(result.massagem.available, 0);
  assert.equal(result.boquete.available, 2);
});

test("resgate só tira do prêmio de quem subiu", () => {
  const current = balances(
    [
      { minutes: 60, owner: "lucas" },
      { minutes: 60, owner: "gi" },
    ],
    [],
  );
  assert.equal(redeemError(current, "massagem", 5), null);
  assert.equal(redeemError(current, "massagem", 6), "not-enough");
  assert.equal(redeemError(current, "boquete", 2), null);
  assert.equal(redeemError(current, "boquete", 0), "minutes-invalid");

  const after = balances(
    [{ minutes: 60, owner: "gi" }],
    [{ kind: "massagem", minutes: 3 }],
  );
  assert.equal(after.massagem.available, 2);
  assert.equal(after.boquete.available, 0);
});

test("não desfaz escada se o prêmio daquele ciclo já foi usado", () => {
  const sessions = [
    { minutes: 60, owner: "lucas" as const },
    { minutes: 30, owner: "lucas" as const },
  ];
  const redemptions = [{ kind: "boquete" as const, minutes: 2 }];

  assert.equal(undoSessionError(sessions, redemptions, 1), null);
  assert.equal(undoSessionError(sessions, redemptions, 0), "undo-would-overdraw");
});
