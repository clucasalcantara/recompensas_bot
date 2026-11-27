import assert from "node:assert/strict";
import test from "node:test";
import { composePlay, readCompletion, rollTone, systemPrompt, userPrompt } from "./suggest.js";

const names = { giName: "Gi", lucasName: "Lucas" };

test("o tom sorteia romance, sexo e os dois", () => {
  assert.equal(rollTone(() => 0), "romantico");
  assert.equal(rollTone(() => 0.5), "sexual");
  assert.equal(rollTone(() => 0.9), "misto");
});

test("o pedido pede romance e sexo, sem catálogo", () => {
  const system = systemPrompt();
  assert.match(system, /romântico|Romance/);
  assert.match(system, /Sexo/);
  assert.match(system, /Não entregue só sexo/);

  const sexual = userPrompt({
    names,
    kind: "dica",
    tone: "sexual",
    seed: "abc",
  });
  assert.match(sexual, /Gi e Lucas/);
  assert.match(sexual, /explícito/);
  assert.doesNotMatch(sexual, /Deixa o celular/);
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
    await composePlay("moeda", names, { apiKey: "k", model: "m", fetchImpl, rng: () => 0.9 }),
    /^Coroa\.\nconduz o beijo$/,
  );
});
