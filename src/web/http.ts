import { readCookie } from "./auth.js";
import { dispatch, type WebDeps } from "./dispatch.js";

export async function handleWebRequest(req: Request, deps: WebDeps): Promise<Response> {
  try {
    if (!originOk(req)) return json(403, { error: "Não é daqui." });
    const url = new URL(req.url);
    const body = req.method === "POST" ? await readJson(req) : {};
    const result = await dispatch(
      {
        method: req.method,
        op: url.searchParams.get("op") ?? "",
        cookie: readCookie(req.headers.get("cookie") ?? undefined, "casa"),
        body,
        ip: ipOf(req),
        now: Date.now(),
        secure: secureOf(req),
      },
      deps,
    );
    const headers = new Headers();
    if (result.cookie) headers.set("set-cookie", result.cookie);
    return json(result.status, result.body, headers);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return json(400, { error: "Não entendi." });
  }
}

function json(status: number, body: unknown, headers = new Headers()): Response {
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function originOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 20_000) throw new Error("corpo grande");
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

function ipOf(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function secureOf(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  const host = req.headers.get("host") ?? "";
  return !host.startsWith("localhost") && !host.startsWith("127.0.0.1");
}
