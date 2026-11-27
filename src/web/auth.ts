import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type Who = "lucas" | "gi";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function passwordOk(given: string, expected: string): boolean {
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function whoByName(
  raw: string,
  names: { lucasName: string; giName: string },
): Who | null {
  const text = fold(raw);
  if (!text) return null;
  if (text === fold(names.giName)) return "gi";
  if (text === fold(names.lucasName)) return "lucas";
  return null;
}

export function signSession(who: Who, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ w: who, e: now + SESSION_MS })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now()): Who | null {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      w?: unknown;
      e?: unknown;
    };
    if (body.w !== "lucas" && body.w !== "gi") return null;
    if (typeof body.e !== "number" || body.e < now) return null;
    return body.w;
  } catch {
    return null;
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_MS / 1000): string {
  return `casa=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function fold(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
