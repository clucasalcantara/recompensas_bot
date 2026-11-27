export type Config = {
  token: string;
  allowedUserIds: number[];
  lucasName: string;
  giName: string;
  databaseUrl: string;
  togetherApiKey: string;
  togetherModel: string;
  reminderHour: number;
  reminderMinute: number;
  reminderTimeZone: string;
  reminderChatId: number | null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.BOT_TOKEN?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const togetherApiKey = env.TOGETHER_API_KEY?.trim();
  if (!token) throw new Error("Falta BOT_TOKEN no .env");
  if (!databaseUrl) throw new Error("Falta DATABASE_URL no .env");
  if (!togetherApiKey) throw new Error("Falta TOGETHER_API_KEY no .env");

  return {
    token,
    allowedUserIds: parseIds(env.ALLOWED_USER_IDS),
    lucasName: env.LUCAS_NAME?.trim() || "Lucas",
    giName: env.GI_NAME?.trim() || "Gi",
    databaseUrl,
    togetherApiKey,
    togetherModel: env.TOGETHER_MODEL?.trim() || "openai/gpt-oss-120b",
    reminderHour: parseBounded(env.REMINDER_HOUR, 9, 23, "REMINDER_HOUR"),
    reminderMinute: parseBounded(env.REMINDER_MINUTE, 0, 59, "REMINDER_MINUTE"),
    reminderTimeZone:
      env.REMINDER_TZ?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminderChatId: parseChatId(env.REMINDER_CHAT_ID),
  };
}

function parseBounded(
  raw: string | undefined,
  fallback: number,
  max: number,
  label: string,
): number {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} inválido: ${raw}`);
  }
  return value;
}

function parseChatId(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value === 0) {
    throw new Error(`REMINDER_CHAT_ID inválido: ${raw}`);
  }
  return value;
}

function parseIds(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}
