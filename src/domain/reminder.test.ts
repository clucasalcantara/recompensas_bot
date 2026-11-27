import assert from "node:assert/strict";
import test from "node:test";
import { balances } from "./ledger.js";
import { buildReminder, shouldSendReminder } from "./reminder.js";

const TZ = "America/Sao_Paulo";

test("o lembrete sai uma vez por dia, depois do horário", () => {
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T11:59:00.000Z"),
      timeZone: TZ,
      hour: 9,
      minute: 0,
      lastSentOn: null,
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T12:00:00.000Z"),
      timeZone: TZ,
      hour: 9,
      minute: 0,
      lastSentOn: null,
    }),
    true,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-26T18:00:00.000Z"),
      timeZone: TZ,
      hour: 9,
      minute: 0,
      lastSentOn: "2026-11-26",
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: new Date("2026-11-27T12:00:00.000Z"),
      timeZone: TZ,
      hour: 9,
      minute: 0,
      lastSentOn: "2026-11-26",
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
    streak: 0,
    tip: "fica perto",
    dare: "sobe 15",
  });
  assert.match(empty, /ainda não começou/);
  assert.match(empty, /massagem/);
  assert.match(empty, /fica perto/);

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
    streak: 1,
    tip: "pergunta o ritmo",
    dare: "sem celular",
  });
  assert.match(waiting, /ainda não teve escada/);
  assert.match(waiting, /massagem pra coletar/);
  assert.match(waiting, /mamadinha pra coletar/);
  assert.match(waiting, /20 min no banco/);
});
