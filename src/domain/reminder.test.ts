import assert from "node:assert/strict";
import test from "node:test";
import { balances } from "./ledger.js";
import { reminderFacts, shouldSendReminder } from "./reminder.js";

const TZ = "America/Sao_Paulo";

test("o lembrete sai uma vez por dia, depois do horário", () => {
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T18:59:00.000Z"),
      timeZone: TZ,
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T19:00:00.000Z"),
      timeZone: TZ,
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    true,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T22:00:00.000Z"),
      timeZone: TZ,
      hour: 16,
      minute: 0,
      lastSentOn: "2026-11-26",
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-27T19:00:00.000Z"),
      timeZone: TZ,
      hour: 16,
      minute: 0,
      lastSentOn: "2026-11-26",
    }),
    true,
  );
});

test("em Vancouver o lembrete é às 16h, não às 9h", () => {
  const zone = "America/Vancouver";
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T17:00:00.000Z"),
      timeZone: zone,
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-27T00:00:00.000Z"),
      timeZone: zone,
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    true,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-07-15T16:00:00.000Z"),
      timeZone: zone,
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-07-15T23:00:00.000Z"),
      timeZone: zone,
      hour: 16,
      minute: 0,
      lastSentOn: null,
    }),
    true,
  );
});

test("os fatos do lembrete trazem o saldo aberto, sem texto pronto", () => {
  const empty = reminderFacts({
    giName: "Gi",
    lucasName: "Lucas",
    current: balances([], []),
    everLogged: false,
    loggedToday: false,
    lucasClimbedToday: false,
    giClimbedToday: false,
    streak: 0,
  });
  assert.match(empty, /Já existiu escada na conta: não/);
  assert.match(empty, /5 min de massagem/);
  assert.doesNotMatch(empty, /Oi, vocês dois/);

  const waiting = reminderFacts({
    giName: "Gi",
    lucasName: "Lucas",
    current: balances(
      [
        { minutes: 80, owner: "lucas" },
        { minutes: 60, owner: "gi" },
      ],
      [],
    ),
    everLogged: true,
    loggedToday: false,
    lucasClimbedToday: false,
    giClimbedToday: false,
    streak: 1,
  });
  assert.match(waiting, /Lucas: minutos que ainda valem: 80/);
  assert.match(waiting, /pode coletar: 1 recompensa de 2 min/);
  assert.doesNotMatch(waiting, /mamadinha/);
  assert.match(waiting, /Gi: minutos que ainda valem: 60/);
  assert.match(waiting, /massagem disponível para coletar: 5 min/);
  assert.match(waiting, /Alguém subiu hoje: não/);
});
