import type { Config } from "./config.js";
import { summarize } from "./domain/ranking.js";
import { buildReminder, shouldSendReminder } from "./domain/reminder.js";
import { zonedStamp } from "./domain/time.js";
import type { Store } from "./store.js";

export function startDailyReminder(deps: {
  config: Config;
  store: Store;
  send: (chatId: number, text: string) => Promise<void>;
}): () => void {
  let lastFailure = 0;
  const tick = () => {
    if (Date.now() - lastFailure < 10 * 60 * 1000) return;
    void runDailyReminder(deps).catch((error: unknown) => {
      lastFailure = Date.now();
      console.error(error instanceof Error ? error.message : error);
    });
  };
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}

export async function runDailyReminder(deps: {
  config: Config;
  store: Store;
  send: (chatId: number, text: string) => Promise<void>;
  now?: Date;
}): Promise<"sent" | "skipped" | "no-chat"> {
  const now = deps.now ?? new Date();
  const timeZone = deps.config.reminderTimeZone;
  const today = summarize([], now, timeZone).today;

  if (
    !shouldSendReminder({
      now,
      timeZone,
      hour: deps.config.reminderHour,
      minute: deps.config.reminderMinute,
      lastSentOn: await deps.store.getLastReminderDate(),
    })
  ) {
    return "skipped";
  }

  const chatId = destinationChat(deps.config) ?? (await deps.store.getReminderChat());
  if (chatId === null) return "no-chat";

  const sessions = await deps.store.listSessions();
  const summary = summarize(sessions, now, timeZone);
  const text = buildReminder({
    giName: deps.config.giName,
    lucasName: deps.config.lucasName,
    current: await deps.store.balances(),
    everLogged: sessions.length > 0,
    loggedToday: summary.loggedToday,
    lucasClimbedToday: climbedOn(sessions, deps.config.lucasUserId, summary.today, timeZone),
    giClimbedToday: climbedOn(sessions, deps.config.giUserId, summary.today, timeZone),
    streak: summary.streak,
  });

  await deps.send(chatId, text);
  await deps.store.setLastReminderDate(today);
  return "sent";
}

function climbedOn(
  sessions: { userId: number; createdAt: string }[],
  userId: number | null,
  today: string,
  timeZone: string,
): boolean {
  if (userId === null) return false;
  return sessions.some(
    (session) => session.userId === userId && zonedStamp(new Date(session.createdAt), timeZone).date === today,
  );
}

function destinationChat(config: Config): number | null {
  if (!config.groupsEnabled) return config.allowedUserIds[0] ?? null;
  return config.reminderChatId;
}
