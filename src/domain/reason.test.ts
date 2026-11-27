import assert from "node:assert/strict";
import test from "node:test";
import { balances } from "./ledger.js";
import {
  accountFacts,
  accountQuestion,
  parseDecision,
  reasonSystemPrompt,
  reasonUserPrompt,
  stairWrite,
  type Decision,
} from "./reason.js";

const names = { lucasName: "Caio", giName: "Gi" };
const books = balances(
  [
    { minutes: 40, owner: "lucas" },
    { minutes: 35, owner: "lucas" },
  ],
  [],
);

test("a conta real entra na decisão e o modelo não escreve os números", () => {
  const system = reasonSystemPrompt();
  assert.match(system, /Como que estão os saldos/);
  assert.match(system, /Quantos minutos eu tenho/);
  assert.match(system, /não consegue acessar/i);
  assert.match(system, /ação é balance/);

  const user = reasonUserPrompt({
    speaker: "Caio",
    partner: "Gi",
    ...names,
    balances: books,
    text: "Quantos minutos eu tenho??",
  });
  assert.match(user, /Quantos minutos eu tenho\?\?/);
  assert.match(user, /Caio: 75 min/);
  assert.match(user, /Não copie número nenhum/);
  assert.match(accountFacts({ speaker: "Caio", partner: "Gi", ...names, balances: books }), /2 min de prêmio dele/);
});

test("placar pergunta a conta dos dois e não deixa o modelo inventar", () => {
  assert.equal(accountQuestion("com ta o placar?"), "both");
  assert.equal(accountQuestion("quantos minutos eu tenho"), "me");
  assert.equal(accountQuestion("subi 40"), null);
});

test("saldo no plural e os minutos de quem falou viram a conta", () => {
  assert.deepEqual(parseDecision('{"action":"balance","scope":"both"}'), {
    action: "balance",
    scope: "both",
  });
  assert.deepEqual(parseDecision('{"action":"balance","scope":"me"}'), {
    action: "balance",
    scope: "me",
  });
  assert.equal(
    parseDecision('{"action":"chat","say":"Caio, não consigo acessar essa informação agora."}'),
    null,
  );
  assert.equal(
    parseDecision('{"action":"chat","say":"Tudo certo por aqui, pronto para o que precisar."}'),
    null,
  );
});

test("a escada explícita vale mais que o número que o modelo inventou", () => {
  assert.deepEqual(stairWrite("fiz 40 min de escada", 400, "inventado"), {
    ok: true,
    minutes: 40,
    note: null,
  });
  assert.deepEqual(stairWrite("30 de bike", 30, null), { ok: false, error: "rejected" });
  assert.deepEqual(stairWrite("subi mais 20", 20, null), { ok: true, minutes: 20, note: null });
});

test("o contexto recente entra cortado e a conta da Gi zerada aparece", () => {
  const recent = ["", "  ", ...Array.from({ length: 14 }, (_, index) => `fala ${index}`)];
  const user = reasonUserPrompt({
    speaker: "Gi",
    partner: "Caio",
    ...names,
    balances: balances([], []),
    text: "Como que estão os saldos ?",
    recent,
  });
  assert.match(user, /Quem falou: Gi/);
  assert.match(user, /Gi: 0 min de escada/);
  assert.match(user, /Caio: 0 min de escada/);
  assert.match(user, /Contexto recente:\nfala 2\nfala 3\nfala 4\nfala 5\nfala 6\nfala 7\nfala 8\nfala 9\nfala 10\nfala 11\nfala 12\nfala 13\nMensagem:/);
  assert.match(user, /Mensagem: Como que estão os saldos \?/);

  const quiet = reasonUserPrompt({
    speaker: "Caio",
    partner: "Gi",
    ...names,
    balances: books,
    text: "Oi",
    recent: ["", "   "],
  });
  assert.doesNotMatch(quiet, /Contexto recente/);
});

test("cada ação do modelo vira uma decisão executável", () => {
  const cases: [string, Decision][] = [
    ['{"action":"balance","scope":"both"}', { action: "balance", scope: "both" }],
    ['{"action":"balance","scope":"me"}', { action: "balance", scope: "me" }],
    ['{"action":"balance","scope":"eu"}', { action: "balance", scope: "me" }],
    ['{"action":"balance","scope":"MEU"}', { action: "balance", scope: "me" }],
    ['{"action":"balance","scope":"próprio"}', { action: "balance", scope: "me" }],
    ['{"action":"balance"}', { action: "balance", scope: "both" }],
    ['{"action":"balance","scope":"casal"}', { action: "balance", scope: "both" }],
    ['{"action":"stairs","minutes":"35","note":null}', { action: "stairs", minutes: 35, note: null }],
    ['{"action":"stairs","minutes":35.5,"note":"  hotel  "}', { action: "stairs", minutes: null, note: "hotel" }],
    ['{"action":"stairs","minutes":null,"note":""}', { action: "stairs", minutes: null, note: null }],
    ['{"action":"history"}', { action: "history" }],
    ['{"action":"ranking"}', { action: "ranking" }],
    ['{"action":"rules"}', { action: "rules" }],
    ['{"action":"undo"}', { action: "undo" }],
    ['{"action":"games"}', { action: "games" }],
    ['{"action":"calibrate"}', { action: "calibrate" }],
    ['{"action":"preferences"}', { action: "preferences" }],
    ['{"action":"ask-partner"}', { action: "ask-partner" }],
    ['{"action":"hello","say":"Oi."}', { action: "hello", say: "Oi." }],
    ['{"action":"stop"}', { action: "stop" }],
    ['{"action":"play","kind":"verdade"}', { action: "play", kind: "verdade" }],
    ['{"action":"play","kind":"verdade","heat":"3"}', { action: "play", kind: "verdade", heat: 3 }],
    ['{"action":"play","kind":"desafio","heat":"leve"}', { action: "play", kind: "desafio", heat: 1 }],
    ['{"action":"play","kind":"desafio","heat":"médio"}', { action: "play", kind: "desafio", heat: 2 }],
    ['{"action":"play","kind":"dica","heat":"quente"}', { action: "play", kind: "dica", heat: 3 }],
    ['{"action":"play","kind":"dado"}', { action: "play", kind: "dado" }],
    ['{"action":"play","kind":"brincadeira","heat":9}', { action: "play", kind: "brincadeira" }],
    ['{"action":"play","kind":"moeda","cara":"eu","heat":2}', { action: "coin", cara: "me", heat: 2 }],
    ['{"action":"coin","cara":"Caio","heat":"quente"}', { action: "coin", cara: "lucas", heat: 3 }],
    ['{"action":"coin","cara":"parceira"}', { action: "coin", cara: "partner" }],
    ['{"action":"coin","cara":"Gi","heat":1}', { action: "coin", cara: "gi", heat: 1 }],
    ['{"action":"coin"}', { action: "coin" }],
    ['{"action":"collect","kind":"massagem","minutes":4}', { action: "collect", kind: "massagem", minutes: 4 }],
    ['{"action":"collect","kind":"mamadinha","minutes":"tudo"}', { action: "collect", kind: "boquete", minutes: "all" }],
    ['{"action":"collect","kind":"boquete","minutes":"all"}', { action: "collect", kind: "boquete", minutes: "all" }],
    ['{"action":"collect"}', { action: "collect" }],
    [
      '{"action":"preference","about":"eu","kind":"gosta","note":"beijo   no   pescoco"}',
      { action: "preference", about: "me", kind: "gosta", note: "beijo no pescoco" },
    ],
    [
      '{"action":"preference","about":"Caio","kind":"evita","note":"humilhação"}',
      { action: "preference", about: "lucas", kind: "evita", note: "humilhação" },
    ],
    [
      '{"action":"preference","about":"a gente","kind":"gosta","note":"ficar perto"}',
      { action: "preference", about: "couple", kind: "gosta", note: "ficar perto" },
    ],
    [
      '{"action":"preference","about":"nós","kind":"gosta","note":"massagem"}',
      { action: "preference", about: "couple", kind: "gosta", note: "massagem" },
    ],
    ['{"action":"chat","say":"Fica perto."}', { action: "chat", say: "Fica perto." }],
    ['{"action":"chat","say":"Só vale escada."}', { action: "chat", say: "Só vale escada." }],
  ];

  for (const [raw, expected] of cases) {
    assert.deepEqual(parseDecision(raw), expected, raw);
  }
});

test("JSON sujo, ação inventada e recusa de conta não passam", () => {
  const refused = [
    "não consigo acessar essa informação agora",
    "Nao consigo ver isso",
    "não tenho acesso ao saldo",
    "não posso acessar a conta",
    "Tudo certo por aqui, pronto para o que precisar.",
    "pronto pro que precisar",
  ];
  for (const say of refused) {
    assert.equal(parseDecision(JSON.stringify({ action: "chat", say })), null, say);
  }

  const long = "a".repeat(200);
  assert.deepEqual(parseDecision(JSON.stringify({ action: "chat", say: long })), {
    action: "chat",
    say: "a".repeat(180),
  });
  assert.equal(parseDecision('{"action":"chat","say":"   "}'), null);
  assert.equal(parseDecision('{"action":"preference","about":"eu","kind":"gosta"}'), null);
  assert.equal(parseDecision('{"action":"preference","about":"eu","kind":"quero","note":"beijo"}'), null);
  assert.equal(parseDecision('{"action":"play","kind":"poker"}'), null);
  assert.equal(parseDecision('{"action":"BALANCE"}'), null);
  assert.equal(parseDecision("[]"), null);
  assert.equal(parseDecision("null"), null);
  assert.equal(parseDecision(""), null);
  assert.equal(parseDecision("sem json"), null);
  assert.equal(parseDecision('ok {"action":"hello","say":"Oi."} e também {"action":"stop"}'), null);

  assert.deepEqual(
    parseDecision('```json\n{"action":"stop"}\n```'),
    { action: "stop" },
  );
  assert.deepEqual(parseDecision('Pensando na conta.\n{"action":"hello","say":"Oi."}\nPronto.'), {
    action: "hello",
    say: "Oi.",
  });
  assert.equal(parseDecision('{"action":"hello"}'), null);
  assert.deepEqual(parseDecision('{"action":"rules","extra":"ignora"}'), { action: "rules" });
});

test("a escrita da escada recusa o que não é escada e segura o teto", () => {
  const rejected = [
    "30 de esteira",
    "20 de bicicleta",
    "caminhada de 15",
    "corri 20",
    "correu 15",
    "tô correndo 10",
    "spinning 25",
    "natação 30",
  ];
  for (const text of rejected) {
    assert.deepEqual(stairWrite(text, 20, null), { ok: false, error: "rejected" }, text);
  }

  assert.deepEqual(stairWrite("+35", 999, "x"), { ok: true, minutes: 35, note: null });
  assert.deepEqual(stairWrite("+ 40 hotel", 1, "no"), { ok: true, minutes: 40, note: "hotel" });
  assert.deepEqual(stairWrite("fiz 40 min de escada pesada", 1, "no"), {
    ok: true,
    minutes: 40,
    note: "pesada",
  });
  assert.deepEqual(stairWrite("1h de escada", 1, "no"), { ok: true, minutes: 60, note: null });
  assert.deepEqual(stairWrite("1h30 de escada", 1, "no"), { ok: true, minutes: 90, note: null });
  assert.deepEqual(stairWrite("subi 20 na escada do prédio", 99, "modelo"), {
    ok: true,
    minutes: 20,
    note: "subi na prédio",
  });
  assert.deepEqual(stairWrite("escada", 20, null), { ok: false, error: "need-minutes" });
  assert.deepEqual(stairWrite("400 de escada", 40, null), { ok: false, error: "too-long" });
  assert.deepEqual(stairWrite("0 de escada", 10, null), { ok: false, error: "invalid" });
  assert.deepEqual(stairWrite("40 de escada e 20 de esteira", 40, null), {
    ok: false,
    error: "ambiguous",
  });
  assert.deepEqual(stairWrite("subi mais 20", 20, "depois do jantar"), {
    ok: true,
    minutes: 20,
    note: "depois do jantar",
  });
  assert.deepEqual(stairWrite("subi mais", null, null), { ok: false, error: "need-minutes" });
  assert.deepEqual(stairWrite("subi mais", 0, null), { ok: false, error: "invalid" });
  assert.deepEqual(stairWrite("subi mais", -5, null), { ok: false, error: "invalid" });
  assert.deepEqual(stairWrite("subi mais", 20.5, null), { ok: false, error: "invalid" });
  assert.deepEqual(stairWrite("subi mais", 241, null), { ok: false, error: "too-long" });
  assert.deepEqual(stairWrite("subi mais", 240, null), { ok: true, minutes: 240, note: null });
});
