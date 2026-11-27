import { randomUUID } from "node:crypto";
import type { CoupleNames, PlayKind } from "./domain/play.js";

export type Tone = "romantico" | "sexual" | "misto";

export type GenerateInput = {
  apiKey: string;
  model: string;
  names: CoupleNames;
  kind: PlayKind;
  tone: Tone;
  detail?: string;
  fetchImpl?: typeof fetch;
};

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";

export function rollTone(rng: () => number = Math.random): Tone {
  const n = rng();
  if (n < 1 / 3) return "romantico";
  if (n < 2 / 3) return "sexual";
  return "misto";
}

export function systemPrompt(): string {
  return [
    "Você fala com um casal adulto, em português do Brasil, como uma parceira que conhece os dois.",
    "Cada resposta é uma coisa só, curta.",
    "O tom pode ser romântico, sexual ou os dois.",
    "Romance é cuidado, elogio, conversa, surpresa, rotina de dois.",
    "Sexo é desejo, toque, beijo, massagem, oral e preliminar, entre os dois, com os dois querendo.",
    "Não entregue só sexo. Não entregue só flor. Apimente a relação.",
    "Sem título, sem lista, sem aspas, sem emoji, sem explicar a regra.",
    "Não invente minuto de prêmio. Nunca envolva menores.",
  ].join(" ");
}

export function userPrompt(input: {
  names: CoupleNames;
  kind: PlayKind;
  tone: Tone;
  detail?: string;
  seed?: string;
}): string {
  const tone =
    input.tone === "romantico"
      ? "romântico, sem sexo explícito"
      : input.tone === "sexual"
        ? "sexual, explícito e consensual"
        : "romance e sexo na mesma mensagem";

  const task: Record<PlayKind, string> = {
    dica: "Manda uma dica que eles podem fazer hoje.",
    verdade: "Manda uma pergunta que um faz pro outro.",
    desafio: "Manda um desafio curto. Pode ser clima ou uma escada curta. Se for escada, não mexe no saldo.",
    dado: "O dado já caiu. Invente só o que esse lado pede.",
    moeda: "A moeda já caiu. Invente o que a pessoa que conduz faz.",
    brincadeira: "Inventa uma brincadeira de casal pra agora.",
  };

  return [
    `Casal: ${input.names.giName} e ${input.names.lucasName}.`,
    `Tipo: ${input.kind}.`,
    `Tom: ${tone}.`,
    task[input.kind],
    input.detail ?? "",
    `Semente: ${input.seed ?? randomUUID()}.`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function readCompletion(body: unknown): string {
  const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== "string") throw new Error("A Together não devolveu texto.");
  const text = content.trim().replace(/^["“]|["”]$/g, "");
  if (!text) throw new Error("A Together devolveu vazio.");
  return text;
}

export async function generateLine(input: GenerateInput): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(TOGETHER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 1,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: userPrompt({
            names: input.names,
            kind: input.kind,
            tone: input.tone,
            detail: input.detail,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Together ${response.status}: ${raw.slice(0, 180)}`);
  }
  return readCompletion(JSON.parse(raw) as unknown);
}

export async function composePlay(
  kind: PlayKind,
  names: CoupleNames,
  client: {
    apiKey: string;
    model: string;
    fetchImpl?: typeof fetch;
    rng?: () => number;
  },
): Promise<string> {
  const rng = client.rng ?? Math.random;
  const tone = rollTone(rng);

  if (kind === "dado") {
    const face = 1 + Math.floor(rng() * 6);
    const line = await generateLine({
      ...client,
      names,
      kind,
      tone,
      detail: `O dado caiu em ${face}.`,
    });
    return `Dado: ${face}\n${line}`;
  }

  if (kind === "moeda") {
    const heads = rng() < 0.5;
    const who = heads ? names.giName : names.lucasName;
    const side = heads ? "cara" : "coroa";
    const line = await generateLine({
      ...client,
      names,
      kind,
      tone,
      detail: `Deu ${side}. ${who} conduz.`,
    });
    return `${heads ? "Cara" : "Coroa"}.\n${line}`;
  }

  const line = await generateLine({ ...client, names, kind, tone });
  const title =
    kind === "dica"
      ? "Dica"
      : kind === "verdade"
        ? "Verdade"
        : kind === "desafio"
          ? "Desafio"
          : "Brincadeira";
  return `${title}\n${line}`;
}
