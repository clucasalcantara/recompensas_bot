import assert from "node:assert/strict";
import test from "node:test";
import { formatRanking, summarize, type RankedSession } from "./ranking.js";

const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-11-26T15:00:00.000Z");

function session(
  partial: Pick<RankedSession, "minutes" | "userId" | "actorName" | "createdAt">,
): RankedSession {
  return partial;
}

test("a semana começa na segunda e o domingo anterior fica de fora", () => {
  const summary = summarize(
    [
      session({
        minutes: 10,
        userId: 1,
        actorName: "Lucas",
        createdAt: "2026-11-23T02:00:00.000Z",
      }),
      session({
        minutes: 30,
        userId: 2,
        actorName: "Gi",
        createdAt: "2026-11-22T15:00:00.000Z",
      }),
      session({
        minutes: 40,
        userId: 2,
        actorName: "Gi",
        createdAt: "2026-11-23T15:00:00.000Z",
      }),
      session({
        minutes: 20,
        userId: 1,
        actorName: "Lucas",
        createdAt: "2026-11-26T14:00:00.000Z",
      }),
    ],
    NOW,
    TZ,
  );

  assert.equal(summary.today, "2026-11-26");
  assert.equal(summary.loggedToday, true);
  assert.equal(summary.streak, 1);
  assert.deepEqual(
    summary.week.map((row) => [row.name, row.minutes, row.days]),
    [
      ["Gi", 40, 1],
      ["Lucas", 20, 1],
    ],
  );
  assert.equal(summary.allTime.reduce((sum, row) => sum + row.minutes, 0), 100);
});

test("sequência conta hoje e ontem, e quebra se pular um dia", () => {
  const together = summarize(
    [
      session({
        minutes: 10,
        userId: 1,
        actorName: "Lucas",
        createdAt: "2026-11-25T15:00:00.000Z",
      }),
      session({
        minutes: 10,
        userId: 1,
        actorName: "Lucas",
        createdAt: "2026-11-26T15:00:00.000Z",
      }),
    ],
    NOW,
    TZ,
  );
  assert.equal(together.streak, 2);

  const broken = summarize(
    [
      session({
        minutes: 10,
        userId: 1,
        actorName: "Lucas",
        createdAt: "2026-11-24T15:00:00.000Z",
      }),
    ],
    NOW,
    TZ,
  );
  assert.equal(broken.streak, 0);
  assert.equal(broken.loggedToday, false);
  assert.equal(broken.week[0]?.minutes, 10);
});

test("ranking vazio explica que ainda não teve escada", () => {
  const text = formatRanking(summarize([], NOW, TZ), { giName: "Gi", lucasName: "Lucas" });
  assert.match(text, /Ranking vazio/);
  assert.match(text, /escada/);
});
