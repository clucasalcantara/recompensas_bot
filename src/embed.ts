import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/multilingual-e5-small";

let extractor: FeatureExtractionPipeline | null = null;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  env.cacheDir = process.env.TRANSFORMERS_CACHE ?? ".cache/transformers";
  if (!extractor) {
    extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
  }
  const vectors: number[][] = [];
  for (const text of texts) {
    const tensor = await extractor(text, { pooling: "mean", normalize: true });
    vectors.push(Array.from(tensor.data as Float32Array));
  }
  return vectors;
}

export function passageText(direction: string): string {
  return `passage: ${direction}`;
}

export function queryText(text: string): string {
  return `query: ${text}`;
}
