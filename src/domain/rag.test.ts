import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { openStore } from "../db.js";
import { embedTexts, queryText } from "../embed.js";

test("o rag no banco separa nível e emoção", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl);
  const store = await openStore(databaseUrl);
  try {
    const [memory] = await embedTexts([queryText("uma lembrança de infância dos dois")]);
    const [fantasy] = await embedTexts([queryText("uma fantasia sexual só dos dois")]);
    assert.ok(memory && fantasy);

    const light = await store.searchContent({ level: 1, kind: "verdade", embedding: memory, limit: 3 });
    assert.ok(light.length > 0);
    assert.ok(light.every((hit) => hit.sexualContent === "none" && hit.intensityLevel === 1));
    assert.match(light[0]?.direction ?? "", /infância|infancia/i);

    const hot = await store.searchContent({ level: 3, kind: "verdade", embedding: fantasy, limit: 3 });
    assert.ok(hot.length > 0);
    assert.ok(hot.every((hit) => hit.sexualContent === "explicit" && hit.intensityLevel === 3));
    assert.equal(hot.some((hit) => hit.id === "infancia-que-moldou"), false);
    assert.equal(hot.some((hit) => hit.id === "inseguranca-da-relacao"), false);

    const blocked = await store.searchContent({ level: 3, embedding: memory, limit: 5 });
    assert.ok(blocked.every((hit) => hit.sexualContent === "explicit"));
    assert.equal(blocked.some((hit) => hit.id === "inseguranca-da-relacao"), false);
  } finally {
    await store.close();
  }
});
