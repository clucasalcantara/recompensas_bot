import assert from "node:assert/strict";
import test from "node:test";
import type { Preference } from "./prefs.js";
import { coupleBrief, formatStories, knownHouse, type Story } from "./story.js";

const names = { giName: "Gi", lucasName: "Caio" };

const story: Story = {
  id: 2,
  userId: 1,
  owner: "gi",
  topic: "jantar",
  note: "massa com vinho",
  createdAt: "2026-11-01T00:00:00.000Z",
};

test("a casa entra no texto que o bot usa", () => {
  const prefs: Preference[] = [];
  const brief = coupleBrief(prefs, [story], names);
  assert.match(brief, /Gi escreveu, sobre jantar: massa com vinho/);
  assert.match(formatStories([story], names), /Da casa:/);
  assert.match(knownHouse(prefs, [story], names), /massa com vinho/);
  assert.equal(formatStories([], names), "");
});
