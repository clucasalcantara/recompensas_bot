"use client";

import { useRef, useState } from "react";
import type { House, Names } from "../types";
import { ApiError, api } from "./api";
import { HomeView } from "./home";
import { Lock } from "./lock";
import { NightView } from "./night";
import { NotesView } from "./notes";
import { PlayView } from "./play";

const views = [
  ["casa", "Casa"],
  ["jogos", "Jogos"],
  ["noite", "Noite"],
  ["nos", "Nós"],
] as const;

type View = (typeof views)[number][0];

export function Casa({ names, initialHouse }: { names: Names; initialHouse: House | null }) {
  const [house, setHouse] = useState(initialHouse);
  const [view, setView] = useState<View>("casa");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef(0);

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
    <div className="shell app">
      <header className="top">
        <div>
          <p className="eyebrow">a casa</p>
          <h1>Oi, {house.you}.</h1>
        </div>
        <div className="top-actions">
          <button
            className="quiet"
            type="button"
            onClick={() => run(async () => apply(await api<House>("switch", { name: house.partner })))}
          >
            Passar pra {house.partner}
          </button>
          <button
            className="quiet"
            type="button"
            onClick={() =>
              run(async () => {
                await api("logout", {});
                setHouse(null);
              })
            }
          >
            Sair
          </button>
        </div>
      </header>
      <main>
        {view === "casa" ? <HomeView house={house} busy={busy} run={run} apply={apply} /> : null}
        {view === "jogos" ? <PlayView house={house} busy={busy} run={run} /> : null}
        {view === "noite" ? <NightView busy={busy} run={run} /> : null}
        {view === "nos" ? <NotesView house={house} busy={busy} run={run} apply={apply} /> : null}
      </main>
      <nav className="nav">
        {views.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? "page" : undefined}
            onClick={() => {
              setView(id);
              window.scrollTo(0, 0);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
