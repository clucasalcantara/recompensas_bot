export function houseUrl(webhookUrl: string | undefined): string | null {
  const raw = webhookUrl?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
