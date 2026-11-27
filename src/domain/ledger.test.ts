import assert from "node:assert/strict";
import test from "node:test";
import { balances, openAccount, redeemError, undoSessionError } from "./ledger.js";
import { formatBalance } from "../messages.js";

test("35 e depois 40 fecham um ciclo e deixam 15 no banco", () => {
  const result = balances(
    [
      { minutes: 35, owner: "lucas" },
      { minutes: 40, owner: "lucas" },
    ],
    [],
  );

  assert.equal(result.lucas.totalMinutes, 75);
  assert.equal(result.lucas.cycles, 1);
  assert.equal(result.lucas.bankMinutes, 15);
  assert.equal(result.lucas.minutesToNextCycle, 45);
  assert.deepEqual(result.boquete, { earned: 2, spent: 0, available: 2 });
  assert.equal(result.massagem.available, 0);
});

test("coleta parcial deixa o resto do prêmio disponível", () => {
  const before = balances([{ minutes: 180, owner: "lucas" }], []);
  assert.deepEqual(before.boquete, { earned: 6, spent: 0, available: 6 });

  const after = balances([{ minutes: 180, owner: "lucas" }], [{ kind: "boquete", minutes: 2 }]);
  assert.deepEqual(after.boquete, { earned: 6, spent: 2, available: 4 });
  assert.equal(redeemError(before, "boquete", 2), null);
  assert.equal(redeemError(after, "boquete", 5), "not-enough");
});

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

test("o saldo do bot fala em recompensa", () => {
  const current = balances(
    [
      { minutes: 75, owner: "lucas" },
      { minutes: 60, owner: "lucas" },
      { minutes: 120, owner: "gi" },
    ],
    [
      { kind: "boquete", minutes: 2 },
      { kind: "massagem", minutes: 10 },
    ],
  );

  assert.equal(
    formatBalance({ giName: "Gi", lucasName: "Caio" }, current),
    ["Caio", "75 min", "1 recompensa já coletada. 1 disponível.", "", "Gi", "Zerada", "2 recompensas já coletadas."].join(
      "\n",
    ),
  );
});

test("o saldo aberto tira os ciclos já resgatados", () => {
  const result = balances(
    [
      { minutes: 75, owner: "lucas" },
      { minutes: 60, owner: "lucas" },
      { minutes: 120, owner: "gi" },
    ],
    [
      { kind: "boquete", minutes: 2 },
      { kind: "massagem", minutes: 10 },
    ],
  );

  const caio = openAccount(result.lucas, 2);
  assert.equal(result.lucas.totalMinutes, 135);
  assert.equal(caio.totalMinutes, 75);
  assert.equal(caio.cycles, 1);
  assert.equal(caio.bankMinutes, 15);
  assert.equal(result.boquete.available, 2);

  const gi = openAccount(result.gi, 5);
  assert.equal(result.gi.totalMinutes, 120);
  assert.equal(gi.totalMinutes, 0);
  assert.equal(gi.cycles, 0);
  assert.equal(gi.bankMinutes, 0);
  assert.equal(result.massagem.available, 0);
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
