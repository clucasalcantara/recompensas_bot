"use client";

import { CircleHelp, Coins, Dice5, MessageCircle, PartyPopper, Swords } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { House, Ticket } from "../types";
import { api } from "./api";

const games = [
  ["dica", "Dica", MessageCircle],
  ["verdade", "Verdade", CircleHelp],
  ["desafio", "Desafio", Swords],
  ["brincadeira", "Brincadeira", PartyPopper],
  ["dado", "Dado", Dice5],
  ["moeda", "Moeda", Coins],
] as const;

type GameId = (typeof games)[number][0];

export function PlayView({
  house,
  busy,
  run,
}: {
  house: House;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<boolean>;
}) {
  const [heat, setHeat] = useState<1 | 2 | 3>(1);
  const [cara, setCara] = useState<"lucas" | "gi">("lucas");
  const [kind, setKind] = useState<GameId | "">("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [awaitingCoin, setAwaitingCoin] = useState(false);

  function draw(id: GameId) {
    setKind(id);
    void run(async () => {
      setTicket({ title: "Pensando", text: "Um segundo." });
      try {
        setTicket(
          await api<Ticket>("play", {
            kind: id,
            heat,
            ...(id === "moeda" ? { cara } : {}),
          }),
        );
        setAwaitingCoin(false);
      } catch (error) {
        setTicket(null);
        throw error;
      }
    });
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">Jogos</p>
        <h1 className="font-display text-4xl leading-none">Uma rodada.</h1>
        <p className="max-w-sm text-muted-foreground">O saldo não muda. Leve é carinho, médio é clima, quente é direto.</p>
      </header>

      <TicketCard ticket={ticket} kind={kind} />

      <div className="space-y-5 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Intensidade</p>
          <ToggleGroup
            type="single"
            value={String(heat)}
            onValueChange={(value) => {
              if (value === "1" || value === "2" || value === "3") setHeat(Number(value) as 1 | 2 | 3);
            }}
            className="grid w-full grid-cols-3"
            aria-label="Nível"
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
              variant={kind === id ? "default" : "outline"}
              className="h-12 justify-start gap-2 px-4"
              disabled={busy}
              onClick={() => {
                if (id === "moeda") {
                  setKind(id);
                  setAwaitingCoin(true);
                  return;
                }
                setAwaitingCoin(false);
                draw(id);
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
        <AnimatePresence>
          {awaitingCoin ? (
            <motion.div
              className="space-y-3 border-t border-border pt-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <p className="text-sm text-muted-foreground">Quem é cara?</p>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant={cara === "lucas" ? "default" : "outline"} onClick={() => setCara("lucas")}>
                  {house.lucasName}
                </Button>
                <Button type="button" variant={cara === "gi" ? "default" : "outline"} onClick={() => setCara("gi")}>
                  {house.giName}
                </Button>
              </div>
              <Button type="button" className="w-full" disabled={busy} onClick={() => draw("moeda")}>
                Jogar a moeda
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
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
            O jogo aparece aqui.
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
