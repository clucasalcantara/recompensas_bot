import assert from "node:assert/strict";
import test from "node:test";
import { balances, redeemError, undoSessionError } from "./ledger.js";

test("minutos abaixo de 60 ficam no banco", () => {
  const result = balances([{ minutes: 45 }], []);

  assert.equal(result.cycles, 0);
  assert.equal(result.bankMinutes, 45);
  assert.equal(result.minutesToNextCycle, 15);
  assert.equal(result.massagem.available, 0);
  assert.equal(result.boquete.available, 0);
});

test("cada 60 min paga 5 de massagem e 2 de boquete", () => {
  const one = balances([{ minutes: 60 }], []);
  assert.deepEqual(one.massagem, { earned: 5, spent: 0, available: 5 });
  assert.deepEqual(one.boquete, { earned: 2, spent: 0, available: 2 });
  assert.equal(one.bankMinutes, 0);
  assert.equal(one.minutesToNextCycle, 60);

  const two = balances([{ minutes: 40 }, { minutes: 80 }], []);
  assert.equal(two.totalMinutes, 120);
  assert.equal(two.cycles, 2);
  assert.equal(two.massagem.earned, 10);
  assert.equal(two.boquete.earned, 4);
  assert.equal(two.bankMinutes, 0);
});

test("o que passa do ciclo continua no banco", () => {
  const result = balances([{ minutes: 90 }], []);

  assert.equal(result.cycles, 1);
  assert.equal(result.bankMinutes, 30);
  assert.equal(result.minutesToNextCycle, 30);
  assert.equal(result.massagem.available, 5);
  assert.equal(result.boquete.available, 2);
});

test("resgate só tira do que já foi ganho", () => {
  const current = balances([{ minutes: 60 }], []);
  assert.equal(redeemError(current, "massagem", 5), null);
  assert.equal(redeemError(current, "massagem", 6), "not-enough");
  assert.equal(redeemError(current, "boquete", 2), null);
  assert.equal(redeemError(current, "boquete", 0), "minutes-invalid");

  const after = balances([{ minutes: 60 }], [{ kind: "massagem", minutes: 3 }]);
  assert.equal(after.massagem.available, 2);
  assert.equal(after.boquete.available, 2);
});

test("não desfaz escada se o prêmio daquele ciclo já foi usado", () => {
  const sessions = [{ minutes: 60 }, { minutes: 30 }];
  const redemptions = [{ kind: "boquete" as const, minutes: 2 }];

  assert.equal(undoSessionError(sessions, redemptions, 1), null);
  assert.equal(undoSessionError(sessions, redemptions, 0), "undo-would-overdraw");
});
