import assert from "node:assert/strict";
import test from "node:test";
import { balances } from "./domain/ledger.js";
import {
  chatSystemPrompt,
  chatUserPrompt,
  composePlay,
  decideIntent,
  phraseAccount,
  readCompletion,
  rollTone,
  systemPrompt,
  userPrompt,
} from "./suggest.js";

const names = { giName: "Gi", lucasName: "Lucas" };

test("o tom sorteia romance, sexo e os dois", () => {
  assert.equal(rollTone(() => 0), "romantico");
  assert.equal(rollTone(() => 0.5), "sexual");
  assert.equal(rollTone(() => 0.9), "misto");
});

test("o pedido pede romance e sexo, sem catálogo", () => {
  const system = systemPrompt();
  assert.match(system, /romântico|Romance/);
  assert.match(system, /monogâmico/i);
  assert.match(system, /Nada nojento/);

  const sexual = userPrompt({
    names,
    kind: "dica",
    tone: "sexual",
    seed: "abc",
  });
  assert.match(sexual, /Gi e Lucas/);
  assert.match(sexual, /explícito/);
  assert.doesNotMatch(sexual, /Deixa o celular/);
  assert.match(
    userPrompt({ names, kind: "dica", tone: "romantico", seed: "abc", tastes: "Caio gosta de beijo." }),
    /Caio gosta de beijo/,
  );
});

test("o papo usa a conta de verdade e não mexe nela", () => {
  const system = chatSystemPrompt();
  assert.match(system, /não muda saldo/i);
  assert.match(system, /Não recite saldo/);
  assert.match(system, /Não ofereça opção/);

  const user = chatUserPrompt({
    names,
    speaker: "Caio",
    partner: "Gi",
    text: "que horas você dorme?",
  });
  assert.doesNotMatch(user, /195/);
  assert.match(user, /Quem escreveu: Caio/);
  assert.match(user, /Não cite minutos/);
  assert.match(user, /que horas você dorme/);
});

test("a resposta da Together vira o texto do comando", async () => {
  const requests: { authorization: string; model: string; user: string }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    const headers = new Headers(init?.headers);
    requests.push({
      authorization: headers.get("authorization") ?? "",
      model: body.model,
      user: body.messages.find((message) => message.role === "user")?.content ?? "",
    });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '"Beija devagar e pergunta onde."' } }] }),
      { status: 200 },
    );
  };

  const text = await composePlay("dica", names, {
    apiKey: "secret",
    model: "modelo",
    fetchImpl,
    rng: () => 0,
  });

  assert.equal(text, "Dica\nBeija devagar e pergunta onde.");
  assert.equal(requests[0]?.authorization, "Bearer secret");
  assert.equal(requests[0]?.model, "modelo");
  assert.match(requests[0]?.user ?? "", /romântico/);
  assert.equal(readCompletion({ choices: [{ message: { content: "oi" } }] }), "oi");
});

test("dado e moeda sorteiam o jogo e geram o pedido", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "conduz o beijo" } }] }), {
      status: 200,
    });

  assert.match(
    await composePlay("dado", names, { apiKey: "k", model: "m", fetchImpl, rng: () => 0 }),
    /^Dado: 1\nconduz o beijo$/,
  );
  assert.match(
    await composePlay("moeda", names, {
      apiKey: "k",
      model: "m",
      fetchImpl,
      rng: () => 0.9,
      cara: "lucas",
      heat: 2,
    }),
    /^Coroa\. Gi conduz\.\nconduz o beijo$/,
  );
});

const books = balances(
  [
    { minutes: 40, owner: "lucas" },
    { minutes: 35, owner: "lucas" },
  ],
  [],
);

test("o clima do segundo passe não recebe a conta", async () => {
  let user = "";
  let system = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      temperature: number;
      max_tokens: number;
      messages: { role: string; content: string }[];
    };
    user = body.messages.find((message) => message.role === "user")?.content ?? "";
    system = body.messages.find((message) => message.role === "system")?.content ?? "";
    assert.equal(body.temperature, 0.4);
    assert.equal(body.max_tokens, 80);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Fica perto." } }] }), {
      status: 200,
    });
  };
  const text = await phraseAccount({ apiKey: "k", model: "m", speaker: "Caio", fetchImpl });
  assert.match(system, /Nenhum número/);
  assert.doesNotMatch(user, /\d|coletar|saldo/);
  assert.equal(text, "Fica perto.");
});

test("a decisão vai com a conta real e temperatura zero", async () => {
  const calls: { url: string; body: Record<string, unknown>; authorization: string }[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({
      url: String(url),
      body,
      authorization: new Headers(init?.headers).get("authorization") ?? "",
    });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"action":"balance","scope":"me"}' } }] }),
      { status: 200 },
    );
  };

  assert.equal((await decideIntent({
    apiKey: "secret",
    model: "modelo",
    speaker: "Caio",
    partner: "Gi",
    lucasName: "Caio",
    giName: "Gi",
    balances: books,
    text: "Quantos minutos eu tenho??",
    recent: ["Gi: subi a escada", "Caio: quanto eu tenho"],
    fetchImpl,
  }))?.decision.action, "balance");
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /chat\/completions$/);
  assert.equal(calls[0]!.authorization, "Bearer secret");
  assert.equal(calls[0]!.body.model, "modelo");
  assert.equal(calls[0]!.body.temperature, 0);
  assert.equal(calls[0]!.body.max_tokens, 700);
  assert.equal(calls[0]!.body.reasoning_effort, "low");
  assert.deepEqual(calls[0]!.body.response_format, { type: "json_object" });
  const messages = calls[0]!.body.messages as { role: string; content: string }[];
  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const user = messages.find((message) => message.role === "user")?.content ?? "";
  assert.match(system, /Como que estão os saldos/);
  assert.match(user, /Caio: 75 min/);
  assert.match(user, /Gi: 0 min/);
  assert.match(user, /Quantos minutos eu tenho\?\?/);
  assert.match(user, /Gi: subi a escada/);
  assert.doesNotMatch(user, /secret/);
});

test("o fio aguenta o JSON sujo e não transforma erro da API em ação", async () => {
  const scripted = [
    ['```json\n{"action":"balance","scope":"both"}\n```', { action: "balance", scope: "both" }],
    ['{"action":"stairs","minutes":35,"note":null}', { action: "stairs", minutes: 35, note: null }],
    ['{"action":"chat","say":"Caio, não consigo acessar essa informação agora."}', null],
    ["não é json", null],
  ] as const;

  for (const [content, expected] of scripted) {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    const choice = await decideIntent({
      apiKey: "k",
      model: "m",
      speaker: "Caio",
      partner: "Gi",
      lucasName: "Caio",
      giName: "Gi",
      balances: books,
      text: "Como que estão os saldos ?",
      fetchImpl,
    });
    assert.deepEqual(choice ? choice.decision : null, expected, content);
  }

  const failing: typeof fetch = async () => new Response("boom", { status: 503 });
  await assert.rejects(() =>
    decideIntent({
      apiKey: "k",
      model: "m",
      speaker: "Caio",
      partner: "Gi",
      lucasName: "Caio",
      giName: "Gi",
      balances: books,
      text: "Oi",
      fetchImpl: failing,
    }),
  );
});
