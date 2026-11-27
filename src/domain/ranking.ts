import { CYCLE_MINUTES } from "./rules.js";
import { shiftDate, weekStart, zonedStamp } from "./time.js";

export type RankedSession = {
  minutes: number;
  userId: number;
  actorName: string;
  createdAt: string;
};

export type Score = {
  userId: number;
  name: string;
  minutes: number;
  days: number;
};

export type Summary = {
  today: string;
  loggedToday: boolean;
  streak: number;
  week: Score[];
  allTime: Score[];
};

export function summarize(
  sessions: RankedSession[],
  now: Date,
  timeZone: string,
): Summary {
  const today = zonedStamp(now, timeZone);
  const start = weekStart(today);
  const dated = sessions.map((session) => ({
    session,
    date: zonedStamp(new Date(session.createdAt), timeZone).date,
  }));

  return {
    today: today.date,
    loggedToday: dated.some((entry) => entry.date === today.date),
    streak: stairStreak(
      dated.map((entry) => entry.date),
      today.date,
    ),
    week: scores(dated.filter((entry) => entry.date >= start && entry.date <= today.date)),
    allTime: scores(dated),
  };
}

export function formatRanking(
  summary: Summary,
  names: { giName: string; lucasName: string },
): string {
  if (summary.allTime.length === 0) {
    return [
      "Ranking vazio. Ninguém lançou escada ainda.",
      "",
      `Quem registra aparece aqui. O prêmio não muda: a cada ${CYCLE_MINUTES} min da própria escada, massagem pra ${names.giName} e mamadinha pro ${names.lucasName}.`,
      "",
      "Começa com /escada 20.",
    ].join("\n");
  }

  return [
    "Ranking · quem lançou a escada",
    "",
    ...block("Esta semana", summary.week, true),
    "",
    ...block("Geral", summary.allTime, false),
    "",
    streakLine(summary.streak, summary.loggedToday),
  ].join("\n");
}

function scores(entries: { session: RankedSession; date: string }[]): Score[] {
  const grouped = new Map<number, { name: string; at: string; minutes: number; dates: Set<string> }>();

  for (const entry of entries) {
    const current = grouped.get(entry.session.userId) ?? {
      name: entry.session.actorName,
      at: entry.session.createdAt,
      minutes: 0,
      dates: new Set<string>(),
    };
    current.minutes += entry.session.minutes;
    current.dates.add(entry.date);
    if (entry.session.createdAt >= current.at) {
      current.at = entry.session.createdAt;
      current.name = entry.session.actorName;
    }
    grouped.set(entry.session.userId, current);
  }

  return [...grouped.entries()]
    .map(([userId, row]) => ({
      userId,
      name: row.name,
      minutes: row.minutes,
      days: row.dates.size,
    }))
    .sort((a, b) => b.minutes - a.minutes || b.days - a.days || a.name.localeCompare(b.name, "pt"));
}

function stairStreak(dates: string[], today: string): number {
  const unique = new Set(dates);
  const yesterday = shiftDate(today, -1);
  let cursor = unique.has(today) ? today : unique.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  while (unique.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function block(title: string, rows: Score[], withDays: boolean): string[] {
  if (rows.length === 0) return [title, "Ninguém subiu ainda."];

  let place = 0;
  let lastMinutes = -1;
  const lines = rows.map((row, index) => {
    if (row.minutes !== lastMinutes) {
      place = index + 1;
      lastMinutes = row.minutes;
    }
    const days = withDays ? ` · ${row.days === 1 ? "1 dia" : `${row.days} dias`}` : "";
    return `${place}. ${row.name} — ${row.minutes} min${days}`;
  });

  return [title, ...lines];
}

function streakLine(streak: number, loggedToday: boolean): string {
  if (streak === 0) return "Sequência parada.";
  const days = streak === 1 ? "1 dia" : `${streak} dias`;
  if (!loggedToday) return `Sequência: ${days}. Hoje ainda dá tempo de não quebrar.`;
  return `Sequência: ${days}.`;
}
