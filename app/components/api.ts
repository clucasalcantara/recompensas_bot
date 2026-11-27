export class ApiError extends Error {
  auth: boolean;

  constructor(message: string, auth: boolean) {
    super(message);
    this.auth = auth;
  }
}

export async function api<T>(op: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/web?op=${op}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || "Não deu.", res.status === 401);
  return data as T;
}
