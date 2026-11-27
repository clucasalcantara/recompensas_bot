import type { PlayKind } from "./play.js";
import { parseHeat, type Heat } from "./play.js";
import { learnPreference, type Learned } from "./prefs.js";
import { parseStairs } from "./parse.js";

export type Talk =
  | { type: "stairs" }
  | { type: "stairs-error"; error: "need-minutes" | "rejected" | "invalid" | "too-long" | "ambiguous" }
  | { type: "balance" }
  | { type: "history" }
  | { type: "ranking" }
  | { type: "rules" }
  | { type: "undo" }
  | { type: "games" }
  | { type: "play"; kind: PlayKind; heat?: Heat }
  | { type: "coin"; cara?: "me" | "partner" | "lucas" | "gi"; heat?: Heat }
  | { type: "collect"; raw: string }
  | { type: "preference"; learned: Learned }
  | { type: "calibrate" }
  | { type: "preferences" }
  | { type: "ask-partner" }
  | { type: "hello" }
  | { type: "chat" };

export function understand(
  raw: string,
  names?: { giName: string; lucasName: string },
): Talk {
  const stairs = parseStairs(raw, false);
  if (stairs.type === "stairs") return { type: "stairs" };
  if (stairs.type !== "ignore") return { type: "stairs-error", error: stairs.type };

  const text = fold(raw);

  const coin = coinTalk(text, names);
  if (coin) return coin;

  const play = playTalk(text);
  if (play) return play;
  if (/\b(regras?|ajuda)\b/.test(text) || /\bcomo funciona\b/.test(text)) return { type: "rules" };
  if (/\b(desfaz\w*|errei|volta atras)\b/.test(text) || /\btira o ultimo\b/.test(text)) {
    return { type: "undo" };
  }
  if (/\bhistorico\b/.test(text) || /\bultimos\b/.test(text) || /\bo que a gente (fez|lancou)\b/.test(text)) {
    return { type: "history" };
  }
  if (/\branking\b/.test(text) || /\bquem (fez|subiu|lancou) mais\b/.test(text)) {
    return { type: "ranking" };
  }
  if (
    /\b(saldo|premio|premios|banco)\b/.test(text) ||
    /\bquanto\b/.test(text) ||
    /\bcomo ta\b/.test(text)
  ) {
    return { type: "balance" };
  }

  const collect = collectTalk(text);
  if (collect) return collect;
  if (asksPartner(text, names)) return { type: "ask-partner" };
  if (/\b(me pergunta|calibra|pergunta pra mim|aprende comigo|aprende com a gente)\b/.test(text)) {
    return { type: "calibrate" };
  }
  if (/\b(preferencias|o que voce (sabe|anotou|lembra))\b/.test(text)) return { type: "preferences" };
  const learned = learnPreference(text, {
    giName: names?.giName ?? "Gi",
    lucasName: names?.lucasName ?? "Caio",
  });
  if (learned) return { type: "preference", learned };
  if (/\bjogos?\b/.test(text) || /\bvamos jogar\b/.test(text)) return { type: "games" };
  if (isHello(text)) return { type: "hello" };

  return { type: "chat" };
}

const HELLO =
  /^(?:oi+|oie|ola|hey|e ai|fala|salve|opa|yo|bom dia|boa tarde|boa noite)(?:\s+(?:tudo bem|td bem|beleza|blz))?$/;

function isHello(text: string): boolean {
  return HELLO.test(text);
}

export function helloLine(raw: string, name: string): string {
  const text = fold(raw);
  if (text.startsWith("bom dia")) return `Bom dia, ${name}.`;
  if (text.startsWith("boa tarde")) return `Boa tarde, ${name}.`;
  if (text.startsWith("boa noite")) return `Boa noite, ${name}.`;
  return `Oi, ${name}.`;
}

function playTalk(text: string): Talk | null {
  if (/\bverdade\b/.test(text)) return leveled("verdade", text);
  if (/\bdesafio\b/.test(text)) return leveled("desafio", text);
  if (/\bdica\b/.test(text)) return { type: "play", kind: "dica" };
  if (/\bdado\b/.test(text)) return { type: "play", kind: "dado" };
  if (/\bbrincadeira\b/.test(text)) return { type: "play", kind: "brincadeira" };
  return null;
}

function coinTalk(
  text: string,
  names?: { giName: string; lucasName: string },
): Talk | null {
  if (!/\bmoeda\b/.test(text) && !/\bcara ou coroa\b/.test(text)) return null;
  const cara = caraSide(text, names);
  const heat = parseHeat(text);
  return {
    type: "coin",
    ...(cara ? { cara } : {}),
    ...(heat ? { heat } : {}),
  };
}

function leveled(kind: "verdade" | "desafio", text: string): Talk {
  const heat = parseHeat(text);
  return heat ? { type: "play", kind, heat } : { type: "play", kind };
}

function caraSide(
  text: string,
  names?: { giName: string; lucasName: string },
): "me" | "partner" | "lucas" | "gi" | undefined {
  const gi = fold(names?.giName ?? "gi");
  const lucas = fold(names?.lucasName ?? "lucas");
  if (near(text, "eu", "cara") || near(text, "mim", "cara")) return "me";
  if (near(text, gi, "cara")) return "gi";
  if (near(text, lucas, "cara")) return "lucas";
  if (near(text, "eu", "coroa") || near(text, "mim", "coroa")) return "partner";
  if (near(text, gi, "coroa")) return "lucas";
  if (near(text, lucas, "coroa")) return "gi";
  return undefined;
}

function near(text: string, who: string, role: "cara" | "coroa"): boolean {
  const name = who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${name}\\b.{0,30}\\b${role}\\b|\\b${role}\\b.{0,30}\\b${name}\\b`).test(text);
}

function collectTalk(text: string): Talk | null {
  const word = text.match(/\b(massagem|boquete|mamadinha)\b/)?.[1];
  const kind = word === "mamadinha" ? "boquete" : word;
  const verb = /\b(coleta|coletar|colher|resgatar|resgata|pegar|pega|leva|levar)\b/.test(text);
  const bare = /^(?:quero\s+)?(?:a|o|minha|meu\s+)?(massagem|boquete|mamadinha)(?:\s+tudo|\s+toda)?$/.test(
    text,
  );
  if (!verb && !bare) return null;
  if (!kind) return { type: "collect", raw: "" };

  const cycles = text.match(/(\d+)\s*ciclos?/);
  if (cycles) return { type: "collect", raw: `${kind} ${cycles[1]} ciclos` };
  if (bare || /\b(tudo|toda|todos|todas)\b/.test(text)) return { type: "collect", raw: kind };

  const minutes = text.match(/(\d+)/);
  if (minutes) return { type: "collect", raw: `${kind} ${minutes[1]}` };
  return { type: "collect", raw: kind };
}

function asksPartner(text: string, names?: { giName: string; lucasName: string }): boolean {
  const gi = escapeRe(fold(names?.giName ?? "gi"));
  const lucas = escapeRe(fold(names?.lucasName ?? "lucas"));
  return new RegExp(`\\bpergunta (?:pra|para) (?:a |o )?(?:${gi}|${lucas}|ela|ele)\\b`).test(text);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
