export type ZonedStamp = {
  date: string;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export function zonedStamp(date: Date, timeZone: string): ZonedStamp {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  let hour = Number(read("hour"));
  if (hour === 24) hour = 0;

  const weekday = WEEKDAY[read("weekday")];
  if (weekday === undefined) {
    throw new Error(`Fuso inválido: ${timeZone}`);
  }

  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    hour,
    minute: Number(read("minute")),
    weekday,
  };
}

export function shiftDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function weekStart(stamp: ZonedStamp): string {
  return shiftDate(stamp.date, -stamp.weekday);
}
