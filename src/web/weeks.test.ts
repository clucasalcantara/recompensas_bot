import assert from "node:assert/strict";
import test from "node:test";
import { monthMinutes, weekSeries } from "./weeks.js";

test("a semana e o mês separam a escada dos dois", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const sessions = [
    { minutes: 20, userId: 2, createdAt: "2026-11-26T15:00:00Z" },
    { minutes: 10, userId: 1, createdAt: "2026-11-22T15:00:00Z" },
    { minutes: 99, userId: 1, createdAt: "2020-01-01T00:00:00Z" },
  ];
  const weeks = weekSeries(sessions, 2, "UTC", now);
  assert.equal(weeks.length, 8);
  assert.match(weeks.at(-1)?.label ?? "", /23/);
  assert.equal(weeks.at(-1)?.gi, 20);
  assert.equal(weeks.at(-1)?.lucas, 0);
  assert.match(weeks.at(-2)?.label ?? "", /16/);
  assert.equal(weeks.at(-2)?.lucas, 10);
  assert.equal(
    weeks.reduce((sum, week) => sum + week.lucas, 0),
    10,
  );

  const month = monthMinutes(sessions, 2, "UTC", now);
  assert.equal(month.label, "novembro");
  assert.deepEqual({ lucas: month.lucas, gi: month.gi }, { lucas: 10, gi: 20 });
});
