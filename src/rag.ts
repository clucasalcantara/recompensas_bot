import { embedTexts, queryText } from "./embed.js";
import type { Heat, PlayKind } from "./domain/play.js";
import type { Store } from "./store.js";

export async function retrieveGuide(
  store: Store,
  input: { kind: PlayKind; level: Heat; query: string },
): Promise<string | null> {
  const [embedding] = await embedTexts([queryText(`${input.query}\n${input.kind} nível ${input.level}`)]);
  if (!embedding) return null;
  const [hit] = await store.searchContent({
    level: input.level,
    kind: input.kind,
    embedding,
    limit: 1,
  });
  if (!hit) return null;
  return `Tom de referência, gere original e não copie: ${hit.direction}`;
}
