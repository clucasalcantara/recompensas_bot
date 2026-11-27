import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { upsertContentCards, openStore } from "./db.js";
import { embedTexts, passageText } from "./embed.js";

loadEnv({ override: true });

const file = process.argv[2];
if (!file) throw new Error("Passe o arquivo do lote.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ausente.");

type RawCard = {
  id: string;
  direction: string;
  intensityLevel: number;
  emotionalDepth: string;
  sexualContent: string;
  interactionType: string;
  romanticIntensity: string;
  requiresMutualParticipation: boolean;
  sourceReference: string;
  sourceUrl?: string;
  origin?: string;
};

const cards = JSON.parse(readFileSync(file, "utf8")) as RawCard[];
await openStore(databaseUrl);
const vectors = await embedTexts(cards.map((card) => passageText(card.direction)));
const written = await upsertContentCards(
  databaseUrl,
  cards.map((card, index) => ({
    id: card.id,
    direction: card.direction,
    intensityLevel: card.intensityLevel,
    emotionalDepth: card.emotionalDepth,
    sexualContent: card.sexualContent,
    interactionType: card.interactionType,
    romanticIntensity: card.romanticIntensity,
    requiresMutual: card.requiresMutualParticipation,
    sourceReference: card.sourceReference,
    sourceUrl: card.sourceUrl ?? null,
    origin: card.origin ?? "pesquisa",
    embedding: vectors[index] ?? [],
  })),
);
console.log(`cards ${written}`);
process.exit(0);
