import assert from "node:assert/strict";
import test from "node:test";
import { addressedToBot, speakerFor } from "./address.js";

const ids = { lucasUserId: 10, giUserId: 20, lucasName: "Lucas", giName: "Gi" };

test("sabe quem está falando pelo id e pelo nome do telegram", () => {
  assert.deepEqual(speakerFor({ ...ids, userId: 10, firstName: "Caio" }), {
    id: 10,
    name: "Caio",
    partnerName: "Gi",
  });
  assert.deepEqual(speakerFor({ ...ids, userId: 20, firstName: "Giovana" }), {
    id: 20,
    name: "Giovana",
    partnerName: "Lucas",
  });
});

test("no grupo só responde marcação, resposta ou comando", () => {
  assert.equal(
    addressedToBot({ chatType: "private", text: "oi", replyToBot: false, mentionsBot: false }),
    true,
  );
  assert.equal(
    addressedToBot({ chatType: "supergroup", text: "oi", replyToBot: false, mentionsBot: false }),
    false,
  );
  assert.equal(
    addressedToBot({ chatType: "group", text: "oi", replyToBot: true, mentionsBot: false }),
    true,
  );
  assert.equal(
    addressedToBot({ chatType: "group", text: "oi", replyToBot: false, mentionsBot: true }),
    true,
  );
  assert.equal(
    addressedToBot({ chatType: "group", text: "+35", replyToBot: false, mentionsBot: false }),
    true,
  );
  assert.equal(
    addressedToBot({ chatType: "group", text: "/saldo", replyToBot: false, mentionsBot: false }),
    true,
  );
});
