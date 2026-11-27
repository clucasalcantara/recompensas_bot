"use client";

import { CircleHelp, Coins, Dice5, MessageCircle, PartyPopper, Swords } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { House, Table, Ticket } from "../types";
import { ApiError, api } from "./api";

const games = [
  ["dica", "Dica", MessageCircle],
  ["verdade", "Verdade", CircleHelp],
  ["desafio", "Desafio", Swords],
  ["brincadeira", "Brincadeira", PartyPopper],
  ["dado", "Dado", Dice5],
  ["moeda", "Moeda", Coins],
] as const;

type GameId = (typeof games)[number][0];
type Side = "lucas" | "gi";

const posed = new Set<GameId>(["verdade", "desafio"]);

export function PlayView({
  house,
  busy,
  run,
  onAuth,
}: {
  house: House;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<boolean>;
  onAuth: () => void;
}) {
  const [table, setTable] = useState<Table | null>(null);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const hold = useRef(false);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    let stop = false;
    async function pull() {
      if (hold.current) return;
      try {
        const next = await api<Table>("mesa", {});
        if (!stop && !hold.current) setTable(next);
      } catch (error) {
        if (error instanceof ApiError && error.auth) onAuthRef.current();
      }
    }
    void pull();
    const id = window.setInterval(() => void pull(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (table?.phase !== "writing") setDraft("");
  }, [table?.phase]);

  async function mutate(fn: () => Promise<Table>) {
    hold.current = true;
    try {
      await run(async () => setTable(await fn()));
    } finally {
      hold.current = false;
    }
  }

  function nameOf(side: Side) {
    return side === "gi" ? house.giName : house.lucasName;
  }

  const heat = table?.heat ?? 1;
  const kind = (table?.kind || "") as GameId | "";
  const mine = table?.writer === house.who;
  const ticket: Ticket | null = thinking
    ? { title: "Pensando", text: "Um segundo." }
    : table?.phase === "card"
      ? { title: table.title, text: table.text, offline: table.offline }
      : table?.phase === "writing" && !mine
        ? { title: kind === "desafio" ? "Desafio" : "Verdade", text: waiting(table, nameOf) }
        : null;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">Jogos</p>
        <h1 className="font-display text-4xl leading-none">Uma rodada.</h1>
        <p className="max-w-sm text-muted-foreground">
          {table?.partnerHere
            ? `${house.partner} está neste jogo.`
            : `Abre no celular de ${house.partner} pra jogar junto.`}{" "}
          O nível é dos dois.
        </p>
      </header>

      <TicketCard ticket={ticket} kind={kind} />

      <div className="space-y-5 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Nível dos dois</p>
          <ToggleGroup
            type="single"
            value={String(heat)}
            onValueChange={(value) => {
              if (value !== "1" && value !== "2" && value !== "3") return;
              const next = Number(value) as 1 | 2 | 3;
              setTable((current) => (current ? { ...current, heat: next } : current));
              void mutate(() => api<Table>("heat", { heat: next }));
            }}
            className="grid w-full grid-cols-3"
            aria-label="Nível dos dois"
          >
            <ToggleGroupItem value="1" className="h-11 w-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Leve
            </ToggleGroupItem>
            <ToggleGroupItem value="2" className="h-11 w-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Médio
            </ToggleGroupItem>
            <ToggleGroupItem value="3" className="h-11 w-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Quente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {games.map(([id, label, Icon]) => (
            <Button
              key={id}
              type="button"
              variant={kind === id && table?.phase !== "idle" ? "default" : "outline"}
              className="h-12 justify-start gap-2 px-4"
              disabled={busy || !table}
              onClick={() => {
                const ai = !posed.has(id) && id !== "moeda";
                if (ai) setThinking(true);
                void mutate(async () => {
                  try {
                    return await api<Table>("open", { kind: id, heat });
                  } finally {
                    setThinking(false);
                  }
                });
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>

        {table?.phase === "role" && kind === "moeda" ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Quem é cara?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={table.cara === "lucas" ? "default" : "outline"}
                disabled={busy}
                onClick={() => void mutate(() => api<Table>("cara", { cara: "lucas" }))}
              >
                {house.lucasName}
              </Button>
              <Button
                type="button"
                variant={table.cara === "gi" ? "default" : "outline"}
                disabled={busy}
                onClick={() => void mutate(() => api<Table>("cara", { cara: "gi" }))}
              >
                {house.giName}
              </Button>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={busy || !table.cara}
              onClick={() => {
                setThinking(true);
                void mutate(async () => {
                  try {
                    return await api<Table>("flip", {});
                  } finally {
                    setThinking(false);
                  }
                });
              }}
            >
              Jogar a moeda
            </Button>
          </div>
        ) : null}
        {table?.phase === "writing" && mine ? (
          <form
            className="space-y-3 border-t border-border pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              void mutate(() => api<Table>("line", { text }));
            }}
          >
            <p className="text-sm text-muted-foreground">{promptFor(table, nameOf)}</p>
            <Textarea
              value={draft}
              maxLength={240}
              placeholder={kind === "desafio" ? "O que a pessoa faz" : "A pergunta"}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" disabled={busy || !draft.trim()}>
              Mandar
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function promptFor(table: Table, nameOf: (side: Side) => string) {
  if (!table.actor) return "";
  if (table.kind === "desafio") return `Escreve o desafio pra ${nameOf(table.actor)}.`;
  const other = table.actor === "gi" ? "lucas" : "gi";
  return `Escreve a pergunta pra ${nameOf(other)}.`;
}

function waiting(table: Table, nameOf: (side: Side) => string) {
  if (!table.writer) return "Um segundo.";
  const writer = nameOf(table.writer);
  if (table.kind === "desafio" && table.actor) {
    return `${writer} está escrevendo o desafio pra ${nameOf(table.actor)}.`;
  }
  return `${writer} está escrevendo a pergunta.`;
}

export function TicketCard({ ticket, kind }: { ticket: Ticket | null; kind?: string }) {
  const reduce = useReducedMotion();
  const thinking = ticket?.title === "Pensando";

  return (
    <div className="min-h-52">
      <AnimatePresence mode="wait">
        {ticket ? (
          <motion.article
            key={`${ticket.title}-${ticket.text}`}
            className="rounded-3xl bg-card px-6 py-7 shadow-sm ring-1 ring-foreground/8"
            initial={reduce ? false : { opacity: 0, y: 28, rotate: kind === "dado" ? -4 : 0 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
          >
            {kind === "moeda" ? <Coin spinning={!!thinking} /> : null}
            {kind === "dado" ? <Die spinning={!!thinking} /> : null}
            <p className="text-xs tracking-[0.14em] text-primary uppercase">{ticket.title}</p>
            <p className={`font-display mt-3 text-2xl leading-snug ${thinking ? "text-muted-foreground" : ""}`}>
              {ticket.text}
            </p>
            {ticket.offline ? (
              <p className="mt-4 text-sm text-muted-foreground">Veio do caderno. A cabeça do bot não respondeu.</p>
            ) : null}
          </motion.article>
        ) : (
          <motion.div
            key="empty"
            className="grid min-h-52 place-items-center rounded-3xl border border-dashed border-border px-6 text-center text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            O jogo aparece aqui, pros dois.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Coin({ spinning }: { spinning: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="mb-5 flex justify-center [perspective:600px]">
      <motion.div
        className="grid size-16 place-items-center rounded-full bg-primary text-sm text-primary-foreground"
        animate={spinning && !reduce ? { rotateY: 360 } : { rotateY: 0 }}
        transition={spinning && !reduce ? { repeat: Infinity, duration: 0.55, ease: "linear" } : { duration: 0.35 }}
      >
        {spinning ? "…" : "cara"}
      </motion.div>
    </div>
  );
}

function Die({ spinning }: { spinning: boolean }) {
  const reduce = useReducedMotion();
  const [face, setFace] = useState(1);

  useEffect(() => {
    if (!spinning) return;
    const id = window.setInterval(() => setFace((value) => (value % 6) + 1), 90);
    return () => window.clearInterval(id);
  }, [spinning]);

  return (
    <div className="mb-5 flex justify-center">
      <motion.div
        className="grid size-16 place-items-center rounded-2xl bg-foreground font-display text-3xl text-background"
        animate={spinning && !reduce ? { rotate: [0, -10, 10, 0] } : { rotate: 0, scale: [0.92, 1] }}
        transition={spinning && !reduce ? { repeat: Infinity, duration: 0.35 } : { duration: 0.3 }}
      >
        {face}
      </motion.div>
    </div>
  );
}
