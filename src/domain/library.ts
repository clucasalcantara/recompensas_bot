import type { Heat, PlayKind } from "./play.js";

export type EmotionalDepth = "light" | "moderate" | "deep";
export type SexualContent = "none" | "suggestive" | "sensual" | "explicit";
export type RomanticIntensity = "low" | "medium" | "high";
export type ContentStatus = "draft" | "review" | "approved" | "active" | "disabled";

export type ContentItem = {
  id: string;
  direction: string;
  intensityLevel: Heat;
  emotionalDepth: EmotionalDepth;
  sexualContent: SexualContent;
  interactionType: PlayKind | "conversa";
  romanticIntensity: RomanticIntensity;
  requiresMutualParticipation: boolean;
  sourceReference: string;
  contentStatus: ContentStatus;
};

export const LIBRARY: ContentItem[] = [
  {
    id: "infancia",
    direction: "uma lembrança de infância dos dois",
    intensityLevel: 1,
    emotionalDepth: "deep",
    sexualContent: "none",
    interactionType: "verdade",
    romanticIntensity: "low",
    requiresMutualParticipation: false,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
  {
    id: "brincadeira-leve",
    direction: "um desafio romântico e leve",
    intensityLevel: 1,
    emotionalDepth: "light",
    sexualContent: "none",
    interactionType: "desafio",
    romanticIntensity: "medium",
    requiresMutualParticipation: true,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
  {
    id: "inseguranca",
    direction: "uma pergunta sobre insegurança na relação",
    intensityLevel: 2,
    emotionalDepth: "deep",
    sexualContent: "none",
    interactionType: "verdade",
    romanticIntensity: "high",
    requiresMutualParticipation: false,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
  {
    id: "provocacao",
    direction: "um desafio de provocação sensual, sem explícito",
    intensityLevel: 2,
    emotionalDepth: "moderate",
    sexualContent: "sensual",
    interactionType: "desafio",
    romanticIntensity: "high",
    requiresMutualParticipation: true,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
  {
    id: "fundo-sem-sexo",
    direction: "uma conversa funda, sem sexo",
    intensityLevel: 3,
    emotionalDepth: "deep",
    sexualContent: "none",
    interactionType: "verdade",
    romanticIntensity: "high",
    requiresMutualParticipation: false,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
  {
    id: "fantasia",
    direction: "uma pergunta sobre fantasia sexual do casal",
    intensityLevel: 3,
    emotionalDepth: "moderate",
    sexualContent: "explicit",
    interactionType: "verdade",
    romanticIntensity: "high",
    requiresMutualParticipation: false,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
  {
    id: "desafio-quente",
    direction: "um desafio sexual explícito entre os dois",
    intensityLevel: 3,
    emotionalDepth: "moderate",
    sexualContent: "explicit",
    interactionType: "desafio",
    romanticIntensity: "high",
    requiresMutualParticipation: true,
    sourceReference: "exemplo de classificação",
    contentStatus: "active",
  },
];

const READY = new Set<ContentStatus>(["approved", "active"]);

export function rankContent(
  items: ContentItem[],
  query: { level: Heat; kind?: ContentItem["interactionType"] },
): ContentItem[] {
  return items
    .filter((item) => READY.has(item.contentStatus))
    .filter((item) => item.intensityLevel === query.level)
    .filter((item) => fitsLevel(query.level, item.sexualContent))
    .filter((item) => !query.kind || item.interactionType === query.kind)
    .sort((a, b) => sexualRank(query.level, b.sexualContent) - sexualRank(query.level, a.sexualContent));
}

export function directionFor(level: Heat, kind: ContentItem["interactionType"]): string | null {
  const item = rankContent(LIBRARY, { level, kind })[0];
  if (!item) return null;
  return `Tom de referência, gere original e não copie: ${item.direction}.`;
}

function fitsLevel(level: Heat, sexual: SexualContent): boolean {
  if (level === 1) return sexual === "none";
  if (level === 2) return sexual !== "explicit";
  return sexual === "explicit";
}

function sexualRank(level: Heat, sexual: SexualContent): number {
  if (level !== 3) return 0;
  return sexual === "explicit" ? 2 : 0;
}
