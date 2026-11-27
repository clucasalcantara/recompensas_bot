const ACCOUNT = /coletar|pr[eê]mio|saldo|mamadinha|massagem|banco|ciclo|minuto|\d/;

export function phraseSystem(): string {
  return [
    "Você manda uma frase de clima para um casal, em português do Brasil.",
    "A conta já foi dita por outra parte. Você não repete minuto, ciclo, saldo, prêmio nem coleta.",
    "Nenhum número. Nenhuma conta. Uma frase, sem lista e sem emoji.",
  ].join(" ");
}

export function phraseUser(input: { speaker: string }): string {
  return `Fale com ${input.speaker}. Uma frase de clima. Sem número.`;
}

export function acceptClimate(phrase: string): string | null {
  const clean = phrase.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (!sentence || ACCOUNT.test(sentence)) return null;
  return sentence.slice(0, 180);
}
