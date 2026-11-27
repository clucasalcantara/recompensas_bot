import assert from "node:assert/strict";
import test from "node:test";
import { balances } from "./ledger.js";
import { buildReminder, shouldSendReminder } from "./reminder.js";

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

test("sem registro o lembrete convida, e com registro cobra o dia", () => {
  const empty = buildReminder({
    giName: "Gi",
    lucasName: "Lucas",
    current: balances([], []),
    everLogged: false,
    loggedToday: false,
    lucasClimbedToday: false,
    giClimbedToday: false,
    streak: 0,
  });
  assert.match(empty, /Oi, vocês dois/);
  assert.match(empty, /ainda não começou/);
  assert.match(empty, /massagem/);
  assert.doesNotMatch(empty, /Dica/);

  const waiting = buildReminder({
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
  assert.match(waiting, /Oi, vocês dois/);
  assert.match(waiting, /Lucas, você tem 80 min/);
  assert.match(waiting, /2 min de mamadinha/);
  assert.match(waiting, /Gi, você tem 60 min/);
  assert.match(waiting, /5 min de massagem/);
  assert.doesNotMatch(waiting, /Dica/);
  assert.doesNotMatch(waiting, /no banco/);
});
