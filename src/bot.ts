import { Bot, InlineKeyboard, type Context } from "grammy";
import type { Config } from "./config.js";
import { addressedToBot, speakerFor, type Speaker } from "./domain/address.js";
import type { Balances } from "./domain/ledger.js";
import { redeemError, undoSessionError } from "./domain/ledger.js";
import { parseCollect, parseStairs } from "./domain/parse.js";
import { formatCoinAsk, formatGameMenu, formatLevelAsk, parseHeat } from "./domain/play.js";
import type { Heat, PlayKind } from "./domain/play.js";
import { formatRanking, summarize } from "./domain/ranking.js";
import { MASSAGE_PER_CYCLE, ORAL_PER_CYCLE, type RewardKind } from "./domain/rules.js";
import {
  answerNote,
  nextQuestion,
  questionById,
  resolveAbout,
  type Learned,
} from "./domain/prefs.js";
import { coupleBrief, knownHouse } from "./domain/story.js";
import { houseUrl } from "./web/url.js";
import { accountQuestion, stairWrite, type AgentChoice, type Decision } from "./domain/reason.js";
import { isExplicitStop, planTurn } from "./domain/scene.js";
import { composePlay, decideIntent, phraseAccount, replyChat } from "./suggest.js";
import { acceptClimate } from "./domain/phrase.js";
import type { Store } from "./store.js";
import {
  formatBalance,
  formatCollectMenu,
  formatDomainError,
  formatHistory,
  formatLog,
  formatOwnBalance,
  formatNothingToCollect,
  formatNothingToUndo,
  formatParseError,
  formatRedeem,
  formatRules,
  formatUndo,
} from "./messages.js";

export function createBot(config: Config, store: Store): Bot {
  const bot = new Bot(config.token);
  const names = { giName: config.giName, lucasName: config.lucasName };

  bot.use(async (ctx, next) => {
    if (!(await store.claimUpdate(ctx.update.update_id))) return;

    const userId = ctx.from?.id;
    if (!userId) return;

    const text = ctx.msg?.text ?? ctx.msg?.caption ?? "";
    const plus = /^\+\s*\d/.test(text.trim());
    const inGroup = Boolean(ctx.chat && ctx.chat.type !== "private");

    if (ctx.chat?.id && text.trim() && (inGroup || ctx.chat.type === "private")) {
      await store.addMessage({
        chatId: ctx.chat.id,
        userId,
        name: ctx.from?.first_name?.trim() || "Alguém",
        role: "user",
        text,
      });
    }

    if (inGroup && !ctx.callbackQuery) {
      if (!config.groupsEnabled && !plus) return;
      const directed = addressedToBot({
        chatType: ctx.chat?.type ?? "group",
        text,
        replyToBot: ctx.msg?.reply_to_message?.from?.id === ctx.me?.id,
        mentionsBot: messageMentionsBot(ctx),
      });
      if (!directed && !isExplicitStop(text)) return;
    }

    if (config.allowedUserIds.length === 0) {
      await ctx.reply(
        `Ainda não liberei ninguém.\nSeu Telegram id é ${userId}. Coloca ele em ALLOWED_USER_IDS no .env e reinicia.`,
      );
      return;
    }

    const allowed = config.allowedUserIds.includes(userId);
    const couple = userId === config.lucasUserId || userId === config.giUserId;
    if (!allowed && !couple) {
      if (!config.groupsEnabled || inGroup) return;
      await ctx.reply("Esse bot é só da gente.");
      return;
    }

    if (!allowed && couple && !inGroup) {
      await ctx.reply("As perguntas ficam no grupo. Me marca lá, ou responde uma mensagem minha.");
      return;
    }

    if (ctx.chat?.type === "private" && ctx.chat.id && allowed) await store.rememberChat(ctx.chat.id);
    await next();
  });

  bot.command(["start", "regras", "ajuda"], async (ctx) => {
    await ctx.reply(formatRules(config));
  });

  bot.command("escada", async (ctx) => {
    await logStairs(ctx, store, config, String(ctx.match ?? ""), true);
  });

  bot.command("saldo", async (ctx) => {
    const current = await store.balances();
    await replyWithPrizes(ctx, formatBalance(config, current), current);
  });

  bot.command("historico", async (ctx) => {
    await ctx.reply(formatHistory(await store.recent(10), config.reminderTimeZone, config));
  });

  bot.command(["ranking", "leaderboard", "rank"], async (ctx) => {
    const summary = summarize(
      await store.listSessions(),
      new Date(),
      config.reminderTimeZone,
    );
    await ctx.reply(formatRanking(summary, names));
  });

  bot.command(["resgatar", "coletar"], async (ctx) => {
    await collectFromText(ctx, store, config, String(ctx.match ?? ""));
  });

  bot.command("massagem", async (ctx) => {
    await collectFromText(ctx, store, config, String(ctx.match ?? ""), "massagem");
  });

  bot.command(["boquete", "mamadinha"], async (ctx) => {
    await collectFromText(ctx, store, config, String(ctx.match ?? ""), "boquete");
  });

  bot.command("desfazer", async (ctx) => {
    await undoLast(ctx, store, config);
  });

  for (const kind of ["dica", "dado", "brincadeira"] as const) {
    bot.command(kind, async (ctx) => {
      await sendPlay(ctx, store, config, kind);
    });
  }

  bot.command("verdade", async (ctx) => {
    await beginLevel(ctx, store, config, "verdade", parseHeat(String(ctx.match ?? "")));
  });

  bot.command("desafio", async (ctx) => {
    await beginLevel(ctx, store, config, "desafio", parseHeat(String(ctx.match ?? "")));
  });

  bot.command("moeda", async (ctx) => {
    const text = `moeda ${String(ctx.match ?? "")}`.trim();
    try {
      const choice = await decideIntent({
        apiKey: config.togetherApiKey,
        model: config.togetherModel,
        speaker: currentSpeaker(ctx, config).name,
        partner: currentSpeaker(ctx, config).partnerName,
        lucasName: config.lucasName,
        giName: config.giName,
        balances: await store.balances(),
        text,
      });
      if (choice?.decision.action === "coin") {
        await beginCoin(ctx, store, config, choice.decision.cara, choice.decision.heat);
        return;
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await beginCoin(ctx, store, config);
  });

  bot.command("preferencias", async (ctx) => {
    await showKnown(ctx, store, config);
  });

  bot.command("jogo", async (ctx) => {
    await ctx.reply(formatGameMenu());
  });

  bot.command("casa", async (ctx) => {
    const url = houseUrl(process.env.WEBHOOK_URL);
    await ctx.reply(
      url
        ? `A casa de vocês, com a escada, os jogos e o que vocês forem contando.\n${url}`
        : "Ainda não tenho o endereço da casa.",
    );
  });

  bot.callbackQuery(/^play:(verdade|desafio):([123])$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendPlay(ctx, store, config, ctx.match[1] as "verdade" | "desafio", Number(ctx.match[2]) as Heat);
  });

  bot.callbackQuery(/^coin:(lucas|gi)(?::([123]))?$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const heat = ctx.match[2] ? (Number(ctx.match[2]) as Heat) : undefined;
    await beginCoin(ctx, store, config, ctx.match[1] as "lucas" | "gi", heat);
  });

  bot.callbackQuery(/^collect:(massagem|boquete)(?::(\d+))?$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const minutes = ctx.match[2] ? Number(ctx.match[2]) : "all";
    await performCollect(ctx, store, config, ctx.match[1] as RewardKind, minutes);
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    await talk(ctx, store, config, ctx.message.text);
  });

  bot.catch((error) => {
    console.error(error);
  });

  return bot;
}

async function talk(
  ctx: Context,
  store: Store,
  config: Config,
  text: string,
): Promise<void> {
  const names = { giName: config.giName, lucasName: config.lucasName };
  const speaker = currentSpeaker(ctx, config);
  const owner = speakerOwner(ctx, config);
  const chatId = ctx.chat?.id ?? null;

  if (isExplicitStop(text)) {
    if (chatId) await store.setScene(chatId, null);
    await ctx.reply("Parou.");
    return;
  }

  await ctx.replyWithChatAction("typing");
  const scene = chatId ? await store.getScene(chatId) : null;
  const sceneWasOpen = scene !== null;
  const recent = chatId
    ? (await store.recentMessages(chatId, 12)).map((line) => `${line.name}: ${line.text}`)
    : [];

  const asked = accountQuestion(text);
  let choice: Awaited<ReturnType<typeof decideIntent>> = asked
    ? ({
        decision: { action: "balance", scope: asked },
        respond: true,
        recipient: "both",
        invite: null,
        sceneMove: "end",
      } satisfies AgentChoice)
    : null;
  if (!asked) {
    try {
      choice = await decideIntent({
        apiKey: config.togetherApiKey,
        model: config.togetherModel,
        speaker: speaker.name,
        partner: speaker.partnerName,
        lucasName: config.lucasName,
        giName: config.giName,
        balances: await store.balances(),
        text,
        recent,
        scene,
        tastes: await houseTastes(store, names),
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      await sayChat(ctx, config, text);
      return;
    }
  }

  const plan = planTurn({
    text,
    place: isGroup(ctx) ? "group" : "private",
    speaker: owner,
    speakerName: speaker.name,
    addressed: true,
    scene,
    choice,
  });
  if (chatId) await store.setScene(chatId, plan.scene);
  if (plan.savePreference && ctx.from?.id) {
    await store.addPreference({
      userId: ctx.from.id,
      owner: plan.savePreference.owner,
      about: plan.savePreference.about,
      kind: plan.savePreference.kind,
      note: plan.savePreference.note,
      question: null,
    });
  }
  if (plan.reply === "quiet") return;
  if (plan.reply === "stop" || plan.reply === "hello" || plan.reply === "model") {
    const line = [plan.text, plan.invite].filter((part) => part && part.length > 0).join("\n");
    if (line) {
      await ctx.reply(line);
      return;
    }
    if (plan.reply === "model") await sayChat(ctx, config, text);
    return;
  }

  const decision = plan.decision;
  if (!decision) return;
  if (choice && (await consumePending(ctx, store, config, text, decision))) return;

  switch (decision.action) {
    case "stairs": {
      const write = stairWrite(text, decision.minutes, decision.note);
      if (!write.ok) {
        await ctx.reply(formatParseError(write.error));
        return;
      }
      await commitStairs(ctx, store, config, write.minutes, write.note, sceneWasOpen);
      return;
    }
    case "balance": {
      const current = await store.balances();
      const line =
        decision.scope === "me" ? formatOwnBalance(config, owner, current) : formatBalance(config, current);
      await sayAccount(ctx, config, line, sceneWasOpen, current);
      return;
    }
    case "history":
      await ctx.reply(formatHistory(await store.recent(10), config.reminderTimeZone, config));
      return;
    case "ranking":
      await ctx.reply(
        formatRanking(
          summarize(await store.listSessions(), new Date(), config.reminderTimeZone),
          names,
        ),
      );
      return;
    case "rules":
      await ctx.reply(formatRules(config));
      return;
    case "undo":
      await undoLast(ctx, store, config, sceneWasOpen);
      return;
    case "games":
      await ctx.reply(formatGameMenu());
      return;
    case "play":
      await sendPlay(ctx, store, config, decision.kind, plan.scene?.heat ?? decision.heat);
      return;
    case "coin":
      await beginCoin(ctx, store, config, decision.cara, plan.scene?.heat ?? decision.heat);
      return;
    case "preference":
      return;
    case "calibrate":
      await askNext(ctx, store, config);
      return;
    case "preferences":
      await showKnown(ctx, store, config);
      return;
    case "ask-partner":
      await askPartner(ctx, store, config);
      return;
    case "hello":
      if (decision.say) await ctx.reply(decision.say);
      return;
    case "stop":
      await ctx.reply("Parou.");
      return;
    case "collect":
      if (!decision.kind) {
        await collectFromText(ctx, store, config, "");
        return;
      }
      await performCollect(ctx, store, config, decision.kind, decision.minutes ?? "all", sceneWasOpen);
      return;
    case "chat":
      if (decision.say) await ctx.reply(decision.say);
  }
}

async function sayChat(ctx: Context, config: Config, text: string): Promise<void> {
  const speaker = currentSpeaker(ctx, config);
  try {
    const line = (
      await replyChat({
        apiKey: config.togetherApiKey,
        model: config.togetherModel,
        names: { giName: config.giName, lucasName: config.lucasName },
        text,
        speaker: speaker.name,
        partner: speaker.partnerName,
      })
    )
      .replace(/\s+/g, " ")
      .trim();
    if (line) {
      await ctx.reply(line);
      return;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
  await ctx.reply(`Tô aqui, ${speaker.name}.`);
}

async function undoLast(
  ctx: Context,
  store: Store,
  config: Config,
  sceneWasOpen = false,
): Promise<void> {
  const last = await store.lastEvent();
  if (!last) {
    await ctx.reply(formatNothingToUndo());
    return;
  }

  if (last.type === "session") {
      const sessions = (await store.listSessions()).map((session) => ({
        minutes: session.minutes,
        owner: session.userId === config.giUserId ? ("gi" as const) : ("lucas" as const),
      }));
      const index = (await store.listSessions()).findIndex((session) => session.id === last.session.id);
    const error = undoSessionError(sessions, await store.listRedemptions(), index);
    if (error) {
      await ctx.reply(formatDomainError(error));
      return;
    }
    await store.deleteSession(last.session.id);
  } else {
    await store.deleteRedemption(last.redemption.id);
  }

  const current = await store.balances();
  await sayAccount(ctx, config, `${formatUndo(last)}\n\n${formatBalance(config, current)}`, sceneWasOpen, current);
}

async function beginLevel(
  ctx: Context,
  store: Store,
  config: Config,
  kind: "verdade" | "desafio",
  heat?: Heat,
): Promise<void> {
  await sendPlay(ctx, store, config, kind, heat ?? 2);
}

async function beginCoin(
  ctx: Context,
  store: Store,
  config: Config,
  cara?: "me" | "partner" | "lucas" | "gi",
  heat?: Heat,
): Promise<void> {
  const side = cara ? resolveCara(ctx, config, cara) : undefined;
  if (!side) {
    await ctx.reply(formatCoinAsk(config.lucasName, config.giName), {
      reply_markup: new InlineKeyboard()
        .text(`${config.lucasName} é cara`, "coin:lucas")
        .text(`${config.giName} é cara`, "coin:gi"),
    });
    return;
  }
  if (!heat) {
    const other = side === "gi" ? config.lucasName : config.giName;
    const who = side === "gi" ? config.giName : config.lucasName;
    await ctx.reply(`${who} é cara. ${other} é coroa.\n\n${formatLevelAsk("moeda")}`, {
      reply_markup: levelKeyboard(`coin:${side}`),
    });
    return;
  }
  await sendPlay(ctx, store, config, "moeda", heat, side);
}

function resolveCara(
  ctx: Context,
  config: Config,
  cara: "me" | "partner" | "lucas" | "gi",
): "lucas" | "gi" {
  const speakerIsGi = ctx.from?.id === config.giUserId;
  if (cara === "gi") return "gi";
  if (cara === "lucas") return "lucas";
  if (cara === "me") return speakerIsGi ? "gi" : "lucas";
  return speakerIsGi ? "lucas" : "gi";
}

function levelKeyboard(prefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("1 · leve", `${prefix}:1`)
    .text("2 · médio", `${prefix}:2`)
    .text("3 · quente", `${prefix}:3`);
}

async function sendPlay(
  ctx: Context,
  store: Store,
  config: Config,
  kind: PlayKind,
  heat?: Heat,
  cara?: "lucas" | "gi",
): Promise<void> {
  await ctx.replyWithChatAction("typing");
  const names = { giName: config.giName, lucasName: config.lucasName };
  const asked = ctx.message?.text?.trim() || kind;
  let guide: string | null = null;
  try {
    const { retrieveGuide } = await import("./rag.js");
    guide = await retrieveGuide(store, { kind, level: heat ?? 2, query: asked });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
  try {
    await ctx.reply(
      await composePlay(kind, names, {
        apiKey: config.togetherApiKey,
        model: config.togetherModel,
        speaker: currentSpeaker(ctx, config).name,
        heat,
        cara,
        tastes: await houseTastes(store, names),
        guide,
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await ctx.reply("Não consegui gerar agora. Manda de novo.");
    return;
  }
}

async function collectFromText(
  ctx: Context,
  store: Store,
  config: Config,
  raw: string,
  assumed?: RewardKind,
): Promise<void> {
  const parsed = parseCollect(raw, assumed);
  if (!parsed.ok) {
    if (parsed.reason === "menu") {
      const current = await store.balances();
      await replyWithPrizes(ctx, formatCollectMenu(config, current), current);
      return;
    }
    await ctx.reply(
      parsed.reason === "usage"
        ? "Usa /coletar, /massagem 2 ciclos ou /mamadinha 4."
        : formatDomainError(parsed.reason === "too-long" ? "minutes-too-long" : "minutes-invalid"),
    );
    return;
  }

  await performCollect(ctx, store, config, parsed.kind, parsed.minutes);
}

async function performCollect(
  ctx: Context,
  store: Store,
  config: Config,
  kind: RewardKind,
  minutes: number | "all",
  sceneWasOpen = false,
): Promise<void> {
  const current = await store.balances();
  const available = current[kind].available;
  const amount = minutes === "all" ? available : minutes;

  if (available <= 0 || amount <= 0) {
    await ctx.reply(formatNothingToCollect(config, current));
    return;
  }

  const error = redeemError(current, kind, amount);
  if (error) {
    await ctx.reply(formatDomainError(error, kind));
    return;
  }

  await store.addRedemption({
    kind,
    minutes: amount,
    actorName: houseName(ctx, config),
    userId: ctx.from?.id ?? 0,
  });
  const after = await store.balances();
  await sayAccount(ctx, config, formatRedeem(kind, amount, after), sceneWasOpen, after);
}

async function logStairs(
  ctx: Context,
  store: Store,
  config: Config,
  raw: string,
  fromCommand: boolean,
): Promise<void> {
  const parsed = parseStairs(raw, fromCommand);
  if (parsed.type === "ignore") return;
  if (parsed.type !== "stairs") {
    await ctx.reply(formatParseError(parsed.type));
    return;
  }

  await commitStairs(ctx, store, config, parsed.minutes, parsed.note);
}

async function commitStairs(
  ctx: Context,
  store: Store,
  config: Config,
  minutes: number,
  note: string | null,
  sceneWasOpen = false,
): Promise<void> {
  const before = await store.balances();
  await store.addSession({
    minutes,
    note,
    actorName: houseName(ctx, config),
    userId: ctx.from?.id ?? 0,
  });
  const after = await store.balances();
  await sayAccount(
    ctx,
    config,
    formatLog({
      config,
      minutes,
      note,
      owner: ctx.from?.id === config.giUserId ? "gi" : "lucas",
      before,
      after,
    }),
    sceneWasOpen,
    after,
  );
}

async function sayAccount(
  ctx: Context,
  config: Config,
  fallback: string,
  sceneWasOpen: boolean,
  current?: Balances,
): Promise<void> {
  let text = fallback;
  if (sceneWasOpen) {
    try {
      const climate = acceptClimate(
        await phraseAccount({
          apiKey: config.togetherApiKey,
          model: config.togetherModel,
          speaker: currentSpeaker(ctx, config).name,
        }),
      );
      if (climate) text = `${fallback}\n${climate}`;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  }
  if (current) {
    await replyWithPrizes(ctx, text, current);
    return;
  }
  await ctx.reply(text);
}

async function replyWithPrizes(ctx: Context, text: string, current: Balances): Promise<void> {
  const keyboard = collectKeyboard(current);
  if (keyboard) {
    await ctx.reply(text, { reply_markup: keyboard });
    return;
  }
  await ctx.reply(text);
}

function collectKeyboard(current: Balances): InlineKeyboard | undefined {
  if (current.massagem.available <= 0 && current.boquete.available <= 0) return undefined;

  const keyboard = new InlineKeyboard();
  addPrizeButtons(keyboard, "massagem", "massagem", current.massagem.available, MASSAGE_PER_CYCLE);
  if (current.massagem.available > 0 && current.boquete.available > 0) keyboard.row();
  addPrizeButtons(keyboard, "boquete", "mamadinha", current.boquete.available, ORAL_PER_CYCLE);
  return keyboard;
}

function addPrizeButtons(
  keyboard: InlineKeyboard,
  kind: RewardKind,
  label: string,
  available: number,
  unit: number,
): void {
  if (available <= 0) return;
  if (available > unit) {
    keyboard.text(`${unit} min de ${label}`, `collect:${kind}:${unit}`);
    keyboard.text(`Tudo · ${available} min`, `collect:${kind}`);
    return;
  }
  keyboard.text(`Levar ${available} min de ${label}`, `collect:${kind}`);
}

async function consumePending(
  ctx: Context,
  store: Store,
  config: Config,
  text: string,
  decision: Decision,
): Promise<boolean> {
  if (isGroup(ctx) && !repliedToBot(ctx)) return false;
  if (decision.action !== "chat" && decision.action !== "preference") return false;
  const userId = ctx.from?.id;
  if (!userId) return false;
  const pendingId = await store.getPendingPref(userId);
  if (!pendingId) return false;
  await answerPending(
    ctx,
    store,
    config,
    text,
    pendingId,
    decision.action === "preference"
      ? { about: decision.about, kind: decision.kind, note: decision.note }
      : null,
  );
  return true;
}

async function answerPending(
  ctx: Context,
  store: Store,
  config: Config,
  text: string,
  pendingId: string,
  learned: Learned | null,
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;
  const speaker = currentSpeaker(ctx, config);
  const question = questionById(pendingId, speaker.name);
  if (!question) {
    await store.setPendingPref(userId, null);
    return;
  }
  const owner = speakerOwner(ctx, config);
  if (learned && (learned.kind !== question.kind || resolveAbout(learned.about, owner) !== owner)) {
    await saveLearned(ctx, store, config, learned);
    await ctx.reply(question.text);
    return;
  }
  const note = learned?.note ?? answerNote(text);
  if (!note) {
    await ctx.reply(`Me fala em uma frase.\n${question.text}`);
    return;
  }
  await store.addPreference({
    userId,
    owner,
    about: owner,
    kind: question.kind,
    note,
    question: question.id,
  });
  await store.setPendingPref(userId, null);
}

async function saveLearned(
  ctx: Context,
  store: Store,
  config: Config,
  learned: Learned,
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;
  const owner = speakerOwner(ctx, config);
  const about = resolveAbout(learned.about, owner);
  await store.addPreference({
    userId,
    owner,
    about,
    kind: learned.kind,
    note: learned.note,
    question: null,
  });
}

async function askNext(ctx: Context, store: Store, config: Config): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;
  const speaker = currentSpeaker(ctx, config);
  const names = { giName: config.giName, lucasName: config.lucasName };
  const question = nextQuestion(await store.listPreferences(), userId, speaker.name);
  if (!question) {
    await ctx.reply(await houseKnown(store, names));
    return;
  }
  await store.setPendingPref(userId, question.id);
  const replyHint = isGroup(ctx) ? "\n\nResponde esta mensagem." : "";
  await ctx.reply(`${question.text}${replyHint}`);
}

async function houseTastes(
  store: Store,
  names: { giName: string; lucasName: string },
): Promise<string> {
  const [prefs, stories] = await Promise.all([store.listPreferences(), store.listStories()]);
  return coupleBrief(prefs, stories, names);
}

async function houseKnown(
  store: Store,
  names: { giName: string; lucasName: string },
): Promise<string> {
  const [prefs, stories] = await Promise.all([store.listPreferences(), store.listStories()]);
  return knownHouse(prefs, stories, names);
}

async function showKnown(ctx: Context, store: Store, config: Config): Promise<void> {
  await ctx.reply(
    await houseKnown(store, { giName: config.giName, lucasName: config.lucasName }),
  );
}

async function askPartner(ctx: Context, store: Store, config: Config): Promise<void> {
  const speaker = currentSpeaker(ctx, config);
  const speakerIsGi = ctx.from?.id === config.giUserId;
  const partnerId = speakerIsGi ? config.lucasUserId : config.giUserId;
  if (!partnerId) {
    await ctx.reply(`Ainda não tenho o id de ${speaker.partnerName}.`);
    return;
  }
  const question = nextQuestion(await store.listPreferences(), partnerId, speaker.partnerName);
  if (!question) {
    await ctx.reply(`${speaker.partnerName} já respondeu o que eu pergunto.`);
    return;
  }
  await store.setPendingPref(partnerId, question.id);
  const prompt = `${speaker.partnerName}, ${question.text}\n\nResponde esta mensagem. Eu guardo e uso nos jogos.`;
  if (isGroup(ctx)) {
    await ctx.reply(prompt);
    return;
  }
  if (!config.groupChatId) {
    await store.setPendingPref(partnerId, null);
    await ctx.reply("Ainda não tenho o grupo. Manda a pergunta lá, me marcando.");
    return;
  }
  try {
    await ctx.api.sendMessage(config.groupChatId, prompt);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await store.setPendingPref(partnerId, null);
    await ctx.reply(`Não consegui falar no grupo. Confere se eu estou lá.`);
    return;
  }
  await ctx.reply(`Perguntei pra ${speaker.partnerName} no grupo.`);
}

function isGroup(ctx: Context): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function repliedToBot(ctx: Context): boolean {
  return ctx.msg?.reply_to_message?.from?.id === ctx.me?.id;
}

function speakerOwner(ctx: Context, config: Config): "lucas" | "gi" {
  return ctx.from?.id === config.giUserId ? "gi" : "lucas";
}

function houseName(ctx: Context, config: Config): string {
  const id = ctx.from?.id;
  if (id && config.giUserId !== null && id === config.giUserId) return config.giName;
  if (id && config.lucasUserId !== null && id === config.lucasUserId) return config.lucasName;
  return ctx.from?.first_name?.trim() || config.lucasName;
}

function currentSpeaker(ctx: Context, config: Config): Speaker {
  return speakerFor({
    userId: ctx.from?.id ?? 0,
    firstName: ctx.from?.first_name,
    lucasUserId: config.lucasUserId,
    giUserId: config.giUserId,
    lucasName: config.lucasName,
    giName: config.giName,
  });
}

function messageMentionsBot(ctx: Context): boolean {
  const username = ctx.me?.username?.toLowerCase();
  const text = ctx.msg?.text ?? ctx.msg?.caption ?? "";
  for (const entity of ctx.msg?.entities ?? ctx.msg?.caption_entities ?? []) {
    if (entity.type === "text_mention" && entity.user.id === ctx.me?.id) return true;
    if (entity.type === "mention" && username) {
      const token = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();
      if (token === `@${username}`) return true;
    }
  }
  return false;
}
