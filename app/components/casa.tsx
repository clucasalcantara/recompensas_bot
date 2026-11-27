"use client";

import { Dices, Heart, House as HouseIcon, Moon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { House, Names } from "../types";
import { ApiError, api } from "./api";
import { HomeView } from "./home";
import { Lock } from "./lock";
import { NightView } from "./night";
import { NotesView } from "./notes";
import { PlayView } from "./play";

const views = [
  ["casa", "Cantinho", HouseIcon],
  ["jogos", "Jogos", Dices],
  ["noite", "Noite", Moon],
  ["nos", "Nós", Heart],
] as const;

type View = (typeof views)[number][0];

export function Casa({ names, initialHouse }: { names: Names; initialHouse: House | null }) {
  const [house, setHouse] = useState(initialHouse);
  const [view, setView] = useState<View>("casa");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef(0);
  const reduce = useReducedMotion();

  function ping(message: string) {
    if (!message) return;
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }

  function apply(next: House) {
    setHouse(next);
    if (next.line) ping(next.line);
  }

  async function run(fn: () => Promise<void>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.auth) setHouse(null);
      else ping(error instanceof Error ? error.message : "Não deu.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!house) return <Lock names={names} busy={busy} run={run} onEnter={apply} />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6">
      <header className="flex items-start justify-between gap-4 pb-8">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary">Nosso Cantinho</p>
          <p className="font-display mt-1 text-2xl leading-none">Oi, {house.you}</p>
        </div>
        <div className="flex shrink-0 gap-1 pt-1">
          <Button
            variant="ghost"
            className="h-10 px-3"
            type="button"
            onClick={() => run(async () => apply(await api<House>("switch", { name: house.partner })))}
          >
            Passar pra {house.partner}
          </Button>
          <Button
            variant="ghost"
            className="h-10 px-3"
            type="button"
            onClick={() =>
              run(async () => {
                await api("logout", {});
                setHouse(null);
              })
            }
          >
            Sair
          </Button>
        </div>
      </header>
      <main className="flex-1 pb-32">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {view === "casa" ? <HomeView house={house} busy={busy} run={run} apply={apply} /> : null}
            {view === "jogos" ? (
              <PlayView house={house} busy={busy} run={run} onAuth={() => setHouse(null)} />
            ) : null}
            {view === "noite" ? <NightView busy={busy} run={run} /> : null}
            {view === "nos" ? <NotesView house={house} busy={busy} run={run} apply={apply} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-3 pt-2 pb-[max(0.7rem,env(safe-area-inset-bottom))]">
          {views.map(([id, label, Icon]) => {
            const current = view === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={current ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs transition-colors ${
                  current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
                onClick={() => {
                  setView(id);
                  window.scrollTo(0, 0);
                }}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <AnimatePresence>
        {toast ? (
          <motion.p
            role="status"
            className="fixed bottom-28 left-1/2 z-50 max-w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-full bg-foreground px-4 py-2.5 text-center text-sm text-background"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
