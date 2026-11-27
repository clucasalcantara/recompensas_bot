export type CadernoNames = { giName: string; lucasName: string };

const SOFT: Record<string, string[]> = {
  dica: [
    "{lucas}, deixa um bilhete curto onde a {gi} vai achar de manhã.",
    "{gi}, pede um beijo demorado antes de qualquer plano.",
  ],
  verdade: [
    "{lucas}, pergunta pra {gi} qual foi o dia recente em que ela se sentiu mais sua.",
    "{gi}, pergunta pro {lucas} o que ele quer repetir da rotina de vocês.",
  ],
  desafio: [
    "{gi}, escolhe uma música e dança um minuto com o {lucas}, sem pressa.",
    "{lucas}, faz um chá ou um copo d'água e entrega pra {gi} sem falar nada.",
  ],
  dado: [
    "Quem tirou o número escolhe o sofá, a cama ou a cozinha, e fica em silêncio um minuto com a outra pessoa.",
    "O número pede um elogio específico, de algo que aconteceu esta semana.",
  ],
  moeda: [
    "Quem conduz pede um abraço do jeito que gosta, e o outro só obedece o pedido.",
    "Quem conduz escolhe a próxima meia hora: filme, conversa ou ficar quieto junto.",
  ],
  brincadeira: [
    "Cada um escreve três coisas que ama na casa de vocês. Troquem os papéis e leiam em voz alta.",
    "De olhos fechados, um descreve o rosto do outro. Quem acertar um detalhe ganha um beijo.",
  ],
  jantar: [
    "Massa simples, uma vela e o telefone na outra peça. {gi} tempera, {lucas} põe a mesa.",
    "Pão, queijo e fruta na cama, como se o jantar não precisasse de mesa.",
  ],
  noite: [
    "Luz baixa, uma música só, e dez minutos de conversa sem resolver nada da vida.",
    "Banho separado, depois sofá. Um conta o dia, o outro só escuta.",
  ],
  programa: [
    "Um caminho a pé até um lugar que vocês já gostam, e um doce no meio.",
    "Escolham um filme que os dois já viram e comentem só as cenas de que gostam.",
  ],
  fofo: [
    "{lucas}, manda pra {gi} uma frase de um momento real de vocês, sem meme.",
    "{gi}, deixa o {lucas} achar a camiseta que ele procura, já separada.",
  ],
};

const MID: Record<string, string[]> = {
  dica: [
    "{gi}, senta no colo do {lucas} e conta o que você quer da noite, devagar.",
    "{lucas}, beija o pescoço da {gi} e para quando ela pedir mais.",
  ],
  verdade: [
    "{gi}, pergunta pro {lucas} onde ele quer a sua mão quando o clima sobe.",
    "{lucas}, pergunta pra {gi} qual elogio deixa ela mais mole.",
  ],
  desafio: [
    "Dois minutos de beijo sem usar as mãos. Quem rir recomeça.",
    "{lucas}, descreve em voz baixa uma coisa que quer fazer com a {gi} hoje.",
  ],
  dado: [
    "O número marca quantos beijos lentos um deve no outro, num lugar que o outro escolher.",
    "Quem tirou escolhe a roupa que sai primeiro, só uma.",
  ],
  moeda: [
    "Quem conduz manda o ritmo do beijo até o outro dizer que quer trocar.",
    "Quem conduz escolhe a luz e pede pra ficar por perto, bem perto.",
  ],
  brincadeira: [
    "Um vende um beijo por uma verdade. O preço é uma frase, não um discurso.",
    "Cada um fala uma vontade de hoje. A outra pessoa escolhe qual das duas acontece primeiro.",
  ],
};

const HOT: Record<string, string[]> = {
  dica: [
    "{gi}, diz pro {lucas} exatamente o que você quer que ele faça com você agora.",
    "{lucas}, pede pra {gi} escolher o quarto e o que sai da roupa.",
  ],
  verdade: [
    "{lucas}, pergunta pra {gi} o que ela quer na boca hoje, e espera a resposta inteira.",
    "{gi}, pergunta pro {lucas} como ele quer gozar, e só faz isso se os dois quiserem.",
  ],
  desafio: [
    "Cinco minutos em que um conduz e o outro só recebe. Depois trocam, se os dois pedirem.",
    "{gi}, senta de frente pro {lucas} e mostra, com a mão, o ritmo que você quer.",
  ],
  dado: [
    "O número é quantos minutos um fica entre as pernas do outro, do jeito que os dois combinarem.",
    "Quem tirou escolhe massagem ou boca, e o outro diz até onde vai.",
  ],
  moeda: [
    "Quem conduz pede o que quer, com palavras claras, e para no instante em que o outro disser.",
    "Quem conduz tira uma peça e pede a próxima, só se o outro concordar.",
  ],
  brincadeira: [
    "Um diz uma frase suja que é verdade. O outro repete com o que acrescentaria.",
    "Escolham uma regra de hoje: quem pede, para quando quiser, e os dois obedecem o pare.",
  ],
};

const TITLES: Record<string, string> = {
  dica: "Dica",
  verdade: "Verdade",
  desafio: "Desafio",
  dado: "Dado",
  moeda: "Moeda",
  brincadeira: "Brincadeira",
  jantar: "Jantar",
  noite: "Hoje à noite",
  programa: "Um programa",
  fofo: "Uma fofura",
};

export function fromCaderno(input: {
  kind: string;
  names: CadernoNames;
  heat?: number;
  rng?: () => number;
}): { title: string; text: string } {
  const rng = input.rng ?? Math.random;
  const heat = input.heat === 2 || input.heat === 3 ? input.heat : 1;
  const deck = heat === 3 ? HOT[input.kind] : heat === 2 ? MID[input.kind] : undefined;
  const lines = deck ?? SOFT[input.kind] ?? SOFT.dica;
  const text = fill(lines[Math.floor(rng() * lines.length) % lines.length] ?? lines[0], input.names);
  const face = input.kind === "dado" ? ` ${1 + Math.floor(rng() * 6)}` : "";
  return { title: `${TITLES[input.kind] ?? "Pra vocês"}${face}`, text };
}

function fill(text: string, names: CadernoNames): string {
  return text.replaceAll("{gi}", names.giName).replaceAll("{lucas}", names.lucasName);
}
