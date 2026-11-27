import { Bot, InlineKeyboard, type Context } from "grammy";
import type { Config } from "./config.js";
import type { Balances } from "./domain/ledger.js";
import { redeemError, undoSessionError } from "./domain/ledger.js";
import { parseCollect, parseStairs } from "./domain/parse.js";
import { formatGameMenu } from "./domain/play.js";
import { formatRanking, summarize } from "./domain/ranking.js";
import type { RewardKind } from "./domain/rules.js";
import { composePlay } from "./suggest.js";
import type { Store } from "./store.js";
import {
  formatBalance,
  formatCollectMenu,
  formatDomainError,
  formatHistory,
  formatLog,
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
    const userId = ctx.from?.id;
    if (!userId) return;

    if (config.allowedUserIds.length === 0) {
      await ctx.reply(
        `Ainda não liberei ninguém.\nSeu Telegram id é ${userId}. Coloca ele em ALLOWED_USER_IDS no .env e reinicia.`,
      );
      return;
    }

    if (!config.allowedUserIds.includes(userId)) {
      await ctx.reply("Esse bot é só da gente.");
      return;
    }

    if (ctx.chat?.id) await store.rememberChat(ctx.chat.id);
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
    await ctx.reply(formatHistory(await store.recent(10), config.reminderTimeZone));
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

  bot.command("boquete", async (ctx) => {
    await collectFromText(ctx, store, config, String(ctx.match ?? ""), "boquete");
  });

  bot.command("desfazer", async (ctx) => {
    const last = await store.lastEvent();
    if (!last) {
      await ctx.reply(formatNothingToUndo());
      return;
    }

    if (last.type === "session") {
      const sessions = await store.listSessions();
      const index = sessions.findIndex((session) => session.id === last.session.id);
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
    await replyWithPrizes(
      ctx,
      `${formatUndo(last)}\n\n${formatBalance(config, current)}`,
      current,
    );
  });

  for (const kind of ["dica", "verdade", "desafio", "dado", "moeda", "brincadeira"] as const) {
    bot.command(kind, async (ctx) => {
      await ctx.replyWithChatAction("typing");
      try {
        await ctx.reply(
          await composePlay(kind, names, {
            apiKey: config.togetherApiKey,
            model: config.togetherModel,
          }),
        );
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        await ctx.reply("Não consegui gerar agora. Manda de novo.");
      }
    });
  }

  bot.command("jogo", async (ctx) => {
    await ctx.reply(formatGameMenu());
  });

  bot.callbackQuery(/^collect:(massagem|boquete)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await performCollect(ctx, store, config, ctx.match[1] as RewardKind, "all");
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    await logStairs(ctx, store, config, ctx.message.text, false);
  });

  bot.catch((error) => {
    console.error(error);
  });

  return bot;
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
        ? "Usa /coletar, /massagem 5 ou /boquete 2."
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
    actorName: actorName(ctx),
    userId: ctx.from?.id ?? 0,
  });
  const after = await store.balances();
  await replyWithPrizes(ctx, formatRedeem(kind, amount, after), after);
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

  const before = await store.balances();
  await store.addSession({
    minutes: parsed.minutes,
    note: parsed.note,
    actorName: actorName(ctx),
    userId: ctx.from?.id ?? 0,
  });
  const after = await store.balances();
  await replyWithPrizes(
    ctx,
    formatLog({
      config,
      minutes: parsed.minutes,
      note: parsed.note,
      before,
      after,
    }),
    after,
  );
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
  if (current.massagem.available > 0) {
    keyboard.text(`Coletar massagem (${current.massagem.available} min)`, "collect:massagem");
  }
  if (current.massagem.available > 0 && current.boquete.available > 0) keyboard.row();
  if (current.boquete.available > 0) {
    keyboard.text(`Coletar boquete (${current.boquete.available} min)`, "collect:boquete");
  }
  return keyboard;
}

function actorName(ctx: Context): string {
  return ctx.from?.first_name?.trim() || "Alguém";
}
