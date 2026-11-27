export type CoupleNames = {
  giName: string;
  lucasName: string;
};

export type PlayKind = "dica" | "verdade" | "desafio" | "dado" | "moeda" | "brincadeira";

export type Heat = 1 | 2 | 3;

export function parseHeat(text: string): Heat | undefined {
  if (/\b1\b/.test(text) || /\bleve\b/.test(text)) return 1;
  if (/\b2\b/.test(text) || /\bmedio\b/.test(text)) return 2;
  if (/\b3\b/.test(text) || /\bquente\b/.test(text)) return 3;
  return undefined;
}

export function formatGameMenu(): string {
  return [
    "Jogos só de vocês dois. O saldo não muda.",
    "",
    "Dica — uma ideia pra hoje.",
    "Verdade — uma pergunta de um pro outro. Escolhe 1, 2 ou 3.",
    "Desafio — um pedido curto. O mesmo 1, 2 ou 3.",
    "Moeda — escolhe quem é cara. A outra pessoa fica coroa. Eu sorteio, e quem cair conduz no nível que você escolher.",
    "Dado — um número de 1 a 6, e o que esse lado pede.",
    "Brincadeira — uma brincadeira de casal pra agora.",
    "",
    "1 é leve. 2 é médio. 3 é quente.",
    "Quente é sexo entre vocês. Conversa funda não muda o nível.",
  ].join("\n");
}

export function formatLevelAsk(kind: "verdade" | "desafio" | "moeda"): string {
  const subject =
    kind === "verdade" ? "A pergunta" : kind === "desafio" ? "O desafio" : "Quem cair na moeda";
  return [
    `${subject} segue o nível.`,
    "1 leve: romance e brincadeira, sem sexo.",
    "2 médio: flerte e sensual, sem explícito.",
    "3 quente: a conversa vai para o sexo, entre vocês.",
    "",
    "Qual nível?",
  ].join("\n");
}

export function formatCoinAsk(lucasName: string, giName: string): string {
  return [
    "Cara ou coroa.",
    "Escolhe quem é cara. A outra pessoa fica coroa.",
    "Eu sorteio. Quem cair conduz, no nível que você escolher.",
    "",
    `Quem é cara, ${lucasName} ou ${giName}?`,
  ].join("\n");
}
