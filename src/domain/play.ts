export type CoupleNames = {
  giName: string;
  lucasName: string;
};

export type PlayKind = "dica" | "verdade" | "desafio" | "dado" | "moeda" | "brincadeira";

export function formatGameMenu(): string {
  return [
    "Cada comando sai na hora. Nada fica repetido.",
    "O saldo não muda. Só a escada paga prêmio.",
    "",
    "/dica — romance, sexo ou os dois",
    "/verdade — uma pergunta",
    "/desafio — um desafio curto",
    "/dado — o número é sorte, o pedido é gerado",
    "/moeda — quem conduz, e o que faz",
    "/brincadeira — uma brincadeira de casal",
  ].join("\n");
}
