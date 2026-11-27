"use client";

import { Heart, Map, Moon, Utensils } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Ticket } from "../types";
import { api } from "./api";
import { TicketCard } from "./play";

const ideas = [
  ["jantar", "Jantar", "Mesa, vela, sem pressa.", Utensils],
  ["noite", "Hoje à noite", "Quando a casa fecha.", Moon],
  ["programa", "Um programa", "Sair, ou ficar.", Map],
  ["fofo", "Uma fofura", "Pequeno e perto.", Heart],
] as const;

export function NightView({
  busy,
  run,
}: {
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<boolean>;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [kind, setKind] = useState("");

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">Noite</p>
        <h1 className="font-display text-4xl leading-none">Uma ideia.</h1>
        <p className="max-w-sm text-muted-foreground">Jantar, programa ou uma fofura. Sem pressa.</p>
      </header>
      <TicketCard ticket={ticket} kind={kind} />
      <div className="grid grid-cols-1 gap-3">
        {ideas.map(([id, label, hint, Icon]) => (
          <Button
            key={id}
            type="button"
            variant={kind === id ? "default" : "outline"}
            className="h-auto items-start justify-start gap-3 px-4 py-4 text-left"
            disabled={busy}
            onClick={() => {
              setKind(id);
              void run(async () => {
                setTicket({ title: "Pensando", text: "Um segundo." });
                try {
                  setTicket(await api<Ticket>("night", { kind: id }));
                } catch (error) {
                  setTicket(null);
                  throw error;
                }
              });
            }}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="flex flex-col items-start gap-0.5">
              <span>{label}</span>
              <span className={kind === id ? "text-primary-foreground/80" : "text-muted-foreground"}>{hint}</span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
