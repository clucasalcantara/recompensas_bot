"use client";

import { useState } from "react";
import type { Ticket } from "../types";
import { api } from "./api";
import { TicketCard } from "./play";

const ideas = [
  ["jantar", "Jantar"],
  ["noite", "Hoje à noite"],
  ["programa", "Um programa"],
  ["fofo", "Uma fofura"],
] as const;

export function NightView({
  busy,
  run,
}: {
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<boolean>;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);

  return (
    <section>
      <p className="lede">Coisa de noite, jantar e um pouco de fofura. Sem pressa.</p>
      <div className="games night">
        {ideas.map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setTicket({ title: "Pensando", text: "Um segundo." });
                try {
                  setTicket(await api<Ticket>("night", { kind: id }));
                } catch (error) {
                  setTicket(null);
                  throw error;
                }
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {ticket ? <TicketCard ticket={ticket} /> : null}
    </section>
  );
}
