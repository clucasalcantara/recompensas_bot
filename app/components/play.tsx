"use client";

import { useState } from "react";
import type { House, Ticket } from "../types";
import { api } from "./api";

const games = [
  ["dica", "Dica"],
  ["verdade", "Verdade"],
  ["desafio", "Desafio"],
  ["brincadeira", "Brincadeira"],
  ["dado", "Dado"],
  ["moeda", "Moeda"],
] as const;

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
  const [kind, setKind] = useState<string>("");
  const [ticket, setTicket] = useState<Ticket | null>(null);

  return (
    <section>
      <p className="lede">Jogos só de vocês. O saldo não muda. 1 é carinho, 2 é clima, 3 é direto.</p>
      <div className="heat" role="radiogroup" aria-label="Nível">
        {(
          [
            [1, "Leve"],
            [2, "Médio"],
            [3, "Quente"],
          ] as const
        ).map(([level, label]) => (
          <button
            key={level}
            type="button"
            className={heat === level ? "on" : undefined}
            aria-pressed={heat === level}
            onClick={() => setHeat(level)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="games">
        {games.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={kind === id ? "on" : undefined}
            disabled={busy}
            onClick={() => {
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
                } catch (error) {
                  setTicket(null);
                  throw error;
                }
              });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="hint">Na moeda, escolhe quem é cara antes de sortear.</p>
      <div className="heat">
        <button
          type="button"
          className={cara === "lucas" ? "on" : undefined}
          aria-pressed={cara === "lucas"}
          onClick={() => setCara("lucas")}
        >
          {house.lucasName} é cara
        </button>
        <button
          type="button"
          className={cara === "gi" ? "on" : undefined}
          aria-pressed={cara === "gi"}
          onClick={() => setCara("gi")}
        >
          {house.giName} é cara
        </button>
      </div>
      {ticket ? <TicketCard ticket={ticket} /> : null}
    </section>
  );
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <article className="ticket">
      <p className="kicker">{ticket.title}</p>
      <p className="ticket-text">{ticket.text}</p>
      {ticket.offline ? <p className="offline">Veio do caderno. A cabeça do bot não respondeu.</p> : null}
    </article>
  );
}
