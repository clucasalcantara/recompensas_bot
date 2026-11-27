import type { Owner } from "./ledger.js";
import { formatKnown, preferenceBrief, type Preference } from "./prefs.js";

export const STORY_TOPICS = ["historia", "apelido", "jantar", "noite", "ritual", "voz"] as const;

export type StoryTopic = (typeof STORY_TOPICS)[number];

export type Story = {
  id: number;
  userId: number;
  owner: Owner;
  topic: StoryTopic;
  note: string;
  createdAt: string;
};

const TOPIC_LABEL: Record<StoryTopic, string> = {
  historia: "história",
  apelido: "apelidos",
  jantar: "jantar",
  noite: "noites",
  ritual: "rituais",
  voz: "o jeito do bot",
};

export function isStoryTopic(value: string): value is StoryTopic {
  return (STORY_TOPICS as readonly string[]).includes(value);
}

export function topicLabel(topic: StoryTopic): string {
  return TOPIC_LABEL[topic];
}

export function cleanNote(raw: unknown, max = 400): string | null {
  if (typeof raw !== "string") return null;
  const note = raw.replace(/\s+/g, " ").trim();
  if (note.length < 3 || note.length > max) return null;
  return note;
}

export function storyBrief(
  items: Story[],
  names: { giName: string; lucasName: string },
): string {
  if (items.length === 0) return "";
  const lines = [
    "Notas que eles escreveram sobre a vida a dois. Use quando couber. Não invente por cima.",
  ];
  for (const item of [...items].sort((a, b) => b.id - a.id).slice(0, 16)) {
    const who = item.owner === "gi" ? names.giName : names.lucasName;
    lines.push(`${who} escreveu, sobre ${TOPIC_LABEL[item.topic]}: ${item.note}`);
  }
  return lines.join("\n");
}

export function formatStories(
  items: Story[],
  names: { giName: string; lucasName: string },
): string {
  if (items.length === 0) return "";
  const lines = ["Da casa:"];
  for (const item of [...items].sort((a, b) => b.id - a.id).slice(0, 20)) {
    const who = item.owner === "gi" ? names.giName : names.lucasName;
    lines.push(`${who}, ${TOPIC_LABEL[item.topic]}: ${item.note}`);
  }
  return lines.join("\n");
}

export function coupleBrief(
  prefs: Preference[],
  stories: Story[],
  names: { giName: string; lucasName: string },
): string {
  const story = storyBrief(stories, names);
  const prefsText = preferenceBrief(prefs, names);
  return story ? `${prefsText}\n\n${story}` : prefsText;
}

export function knownHouse(
  prefs: Preference[],
  stories: Story[],
  names: { giName: string; lucasName: string },
): string {
  const extra = formatStories(stories, names);
  if (prefs.length === 0) return extra || "Ainda não anotei nada de vocês.";
  const known = formatKnown(prefs, names);
  return extra ? `${known}\n\n${extra}` : known;
}
