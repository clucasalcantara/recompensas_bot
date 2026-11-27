import { randomUUID } from "node:crypto";
import type { CoupleNames, Heat, PlayKind } from "./domain/play.js";

export type Tone = "romantico" | "sexual" | "misto";

export type GenerateInput = {
  apiKey: string;
  model: string;
  names: CoupleNames;
  kind: PlayKind;
  tone: Tone;
  detail?: string;
  speaker?: string;
  heat?: Heat;
  tastes?: string;
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
    "Quando o nível for 3, sexo é desejo entre os dois, com os dois querendo.",
    "Casal monogâmico. Só essas duas pessoas. Sem terceira pessoa, sem grupo, sem troca.",
    "Se o pedido trouxer preferência salva, obedeça. Não proponha o que alguém não quer.",
    "Nada nojento, violento, agressivo ou humilhante.",
    "Se souber quem pediu, fale com essa pessoa, no singular. Não cumprimente os dois juntos.",
    "Sem título, sem lista, sem aspas, sem emoji, sem explicar a regra.",
    "Não invente minuto de prêmio. Nunca envolva menores.",
  ].join(" ");
}

export function userPrompt(input: {
  names: CoupleNames;
  kind: PlayKind;
  tone: Tone;
  detail?: string;
  speaker?: string;
  heat?: Heat;
  tastes?: string;
  seed?: string;
}): string {
  const tone = intensity(input.tone, input.heat);

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
    input.speaker
      ? `Quem pediu: ${input.speaker}. Fale com ${input.speaker}, no singular.`
      : "",
    `Tipo: ${input.kind}.`,
    `Tom: ${tone}.`,
    task[input.kind],
    input.tastes ?? "",
    input.detail ?? "",
    `Semente: ${input.seed ?? randomUUID()}.`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function intensity(tone: Tone, heat?: Heat): string {
  if (heat === 1) return "Nível 1, leve. Carinho e clima. Sem sexo explícito.";
  if (heat === 2) return "Nível 2, médio. Sensual e sugestivo. Sem detalhe gráfico.";
  if (heat === 3) return "Nível 3, quente. Explícito e consensual, só entre os dois. Sem violência.";
  if (tone === "romantico") return "romântico, sem sexo explícito";
  if (tone === "sexual") return "sexual, explícito e consensual, só entre os dois";
  return "romance e desejo na mesma mensagem, só entre os dois";
}

export function readCompletion(body: unknown): string {
  const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== "string") throw new Error("A Together não devolveu texto.");
  const text = content.trim().replace(/^["“]|["”]$/g, "");
  if (!text) throw new Error("A Together devolveu vazio.");
  return text;
}

export function chatSystemPrompt(): string {
  return [
    "Você é o bot da escada de um casal adulto, em português do Brasil.",
    "Fala curto, como quem está no chat, não como um manual.",
    "Fale só com a pessoa que escreveu, pelo nome dela, no singular.",
    "Não cumprimente as duas pessoas juntas.",
    "Responda só ao que foi dito. Não recite saldo, prêmio, banco ou minutos.",
    "Não ofereça opção. Não pergunte o que a pessoa quer fazer. Não invente o próximo passo.",
    "Não pergunte gosto nem limite. Isso é anotado fora desta resposta.",
    "Se houver preferência salva, respeite.",
    "Pode ser carinhoso e um pouco apimentado. Não entregue só sexo.",
    "Esta resposta não muda saldo, não lança escada e não coleta prêmio.",
    "Uma frase. Sem lista, sem emoji, sem título.",
  ].join(" ");
}

export function chatUserPrompt(input: {
  names: CoupleNames;
  speaker: string;
  partner: string;
  text: string;
  tastes?: string;
}): string {
  return [
    `Quem escreveu: ${input.speaker}.`,
    `Fale só com ${input.speaker}, no singular.`,
    `A outra pessoa é ${input.partner}. Só mencione ${input.partner} se ${input.speaker} falar dela.`,
    `Não cite minutos, saldo ou prêmio.`,
    input.tastes ?? "",
    `Mensagem: ${input.text}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export async function generateLine(input: GenerateInput): Promise<string> {
  return complete({
    apiKey: input.apiKey,
    model: input.model,
    system: systemPrompt(),
    user: userPrompt({
      names: input.names,
      kind: input.kind,
      tone: input.tone,
      detail: input.detail,
      speaker: input.speaker,
      heat: input.heat,
      tastes: input.tastes,
    }),
    fetchImpl: input.fetchImpl,
  });
}

export async function replyChat(input: {
  apiKey: string;
  model: string;
  names: CoupleNames;
  text: string;
  speaker: string;
  partner: string;
  tastes?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  return complete({
    apiKey: input.apiKey,
    model: input.model,
    system: chatSystemPrompt(),
    user: chatUserPrompt(input),
    fetchImpl: input.fetchImpl,
  });
}

async function complete(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
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
        { role: "system", content: input.system },
        { role: "user", content: input.user },
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
    speaker?: string;
    heat?: Heat;
    cara?: "lucas" | "gi";
    tastes?: string;
  },
): Promise<string> {
  const rng = client.rng ?? Math.random;
  const tone = client.heat ? toneForHeat(client.heat) : rollTone(rng);
  const speaker = client.speaker;
  const heat = client.heat;

  if (kind === "dado") {
    const face = 1 + Math.floor(rng() * 6);
    const line = await generateLine({
      ...client,
      names,
      kind,
      tone,
      speaker,
      heat,
      detail: `O dado caiu em ${face}.`,
    });
    return `Dado: ${face}\n${line}`;
  }

  if (kind === "moeda") {
    const caraName = client.cara === "gi" ? names.giName : names.lucasName;
    const coroaName = client.cara === "gi" ? names.lucasName : names.giName;
    const heads = rng() < 0.5;
    const side = heads ? "cara" : "coroa";
    const who = heads ? caraName : coroaName;
    const line = await generateLine({
      ...client,
      names,
      kind,
      tone,
      speaker,
      heat,
      detail: `${caraName} é cara. ${coroaName} é coroa. Caiu ${side}. ${who} conduz.`,
    });
    return `${heads ? "Cara" : "Coroa"}. ${who} conduz.\n${line}`;
  }

  const line = await generateLine({ ...client, names, kind, tone, speaker, heat });
  const title =
    kind === "dica"
      ? "Dica"
      : kind === "verdade"
        ? heat
          ? `Verdade · nível ${heat}`
          : "Verdade"
        : kind === "desafio"
          ? heat
            ? `Desafio · nível ${heat}`
            : "Desafio"
          : "Brincadeira";
  return `${title}\n${line}`;
}

export function toneForHeat(heat: Heat): Tone {
  if (heat === 1) return "romantico";
  if (heat === 2) return "misto";
  return "sexual";
}
