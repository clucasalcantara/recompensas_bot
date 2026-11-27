export type MinutePoint = {
  minutes: number;
  userId: number;
  createdAt: string;
};

export type WeekBar = {
  label: string;
  lucas: number;
  gi: number;
};

export function weekSeries(
  sessions: MinutePoint[],
  giUserId: number | null,
  timeZone: string,
  now: Date,
  weeks = 8,
): WeekBar[] {
  const current = mondayYmd(zonedYmd(now, timeZone));
  const bars: (WeekBar & { start: string })[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(current, -7 * i);
    bars.push({ start, label: labelOf(start), lucas: 0, gi: 0 });
  }

  for (const session of sessions) {
    const time = new Date(session.createdAt).getTime();
    if (Number.isNaN(time)) continue;
    const day = zonedYmd(new Date(session.createdAt), timeZone);
    const bar = bars.find((item, index) => {
      const next = bars[index + 1]?.start ?? addDays(item.start, 7);
      return day >= item.start && day < next;
    });
    if (!bar) continue;
    if (giUserId !== null && session.userId === giUserId) bar.gi += session.minutes;
    else bar.lucas += session.minutes;
  }

  return bars.map(({ label, lucas, gi }) => ({ label, lucas, gi }));
}

export function monthMinutes(
  sessions: MinutePoint[],
  giUserId: number | null,
  timeZone: string,
  now: Date,
): { label: string; lucas: number; gi: number } {
  const prefix = zonedYmd(now, timeZone).slice(0, 7);
  let lucas = 0;
  let gi = 0;
  for (const session of sessions) {
    const time = new Date(session.createdAt).getTime();
    if (Number.isNaN(time)) continue;
    const day = zonedYmd(new Date(session.createdAt), timeZone);
    if (!day.startsWith(prefix)) continue;
    if (giUserId !== null && session.userId === giUserId) gi += session.minutes;
    else lucas += session.minutes;
  }
  const [year, month] = prefix.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return { label, lucas, gi };
}

function zonedYmd(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function mondayYmd(ymd: string): string {
  const utc = utcDate(ymd);
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  utc.setUTCDate(utc.getUTCDate() - delta);
  return utc.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const utc = utcDate(ymd);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function utcDate(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function labelOf(ymd: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utcDate(ymd));
}
