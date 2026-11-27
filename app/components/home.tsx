"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { House, Side } from "../types";
import { api } from "./api";
import { StairChart } from "./chart";

export function HomeView({
  house,
  busy,
  run,
  apply,
}: {
  house: House;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<boolean>;
  apply: (house: House) => void;
}) {
  const [minutes, setMinutes] = useState("");

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-4xl leading-none">Cada degrau conta.</h1>
        <p className="max-w-sm text-muted-foreground">Os minutos de escada de vocês viram resgates.</p>
      </header>
      <div className="grid gap-4">
        <Person
          name={house.lucasName}
          side="caio"
          data={house.lucas}
          busy={busy}
          onRedeem={(count) =>
            run(async () => {
              apply(
                await api<House>("redeem", {
                  kind: "boquete",
                  minutes: String(count * house.lucas.perCycle),
                }),
              );
            })
          }
        />
        <Person
          name={house.giName}
          side="gi"
          data={house.gi}
          busy={busy}
          onRedeem={(count) =>
            run(async () => {
              apply(
                await api<House>("redeem", {
                  kind: "massagem",
                  minutes: String(count * house.gi.perCycle),
                }),
              );
            })
          }
        />
      </div>
      <StairChart house={house} />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Registrar Cardio</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                apply(await api<House>("log", { minutes }));
                setMinutes("");
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutos</Label>
              <Input
                id="minutes"
                inputMode="numeric"
                autoComplete="off"
                placeholder="40"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Lançar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Últimos passos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {house.recent.length === 0 ? <li className="text-muted-foreground">Nada lançado ainda.</li> : null}
            {house.recent.map((event, index) => (
              <li key={`${event.when}-${event.text}-${index}`} className="flex items-baseline justify-between gap-4">
                <span>{event.text}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{event.when}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function Person({
  name,
  side,
  data,
  busy,
  onRedeem,
}: {
  name: string;
  side: "caio" | "gi";
  data: Side;
  busy: boolean;
  onRedeem: (count: number) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("1");
  const ready = data.perCycle > 0 ? Math.floor(Math.max(0, data.available) / data.perCycle) : 0;
  const collected = data.perCycle > 0 ? Math.floor(data.spent / data.perCycle) : 0;
  const asked = Number(count);
  const askedOk = Number.isInteger(asked) && asked >= 1 && asked <= ready;
  const collectedText =
    collected === 0 ? "" : collected === 1 ? "1 recompensa já coletada." : `${collected} recompensas já coletadas.`;
  const readyText = ready === 0 ? "" : ready === 1 ? "1 disponível." : `${ready} disponíveis.`;
  const status = [collectedText, readyText].filter(Boolean).join(" ");
  return (
    <article className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-foreground/8">
      <p className="text-sm text-muted-foreground">{name}</p>
      <p className={`font-display mt-2 text-5xl leading-none ${side === "caio" ? "text-caio" : "text-gi"}`}>
        {data.totalMinutes === 0 ? "Zerada" : data.totalMinutes}
      </p>
      {data.totalMinutes === 0 ? null : <p className="mt-2 text-sm text-muted-foreground">min</p>}
      {status ? <p className="mt-4 text-sm">{status}</p> : null}
      <Button
        type="button"
        className="mt-4"
        disabled={ready === 0 || busy}
        onClick={() => {
          setCount("1");
          setOpen(true);
        }}
      >
        Resgatar agora
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-5"
          onClick={() => setOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={`resgatar-${side}`}
            className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg ring-1 ring-foreground/8"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!askedOk) return;
              void onRedeem(asked).then((ok) => {
                if (ok) setOpen(false);
              });
            }}
          >
            <h2 id={`resgatar-${side}`} className="font-display text-2xl">
              Quantos resgates?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {ready === 1 ? "Tem 1 disponível." : `Tem ${ready} disponíveis.`}
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor={`quantidade-${side}`}>Quantidade</Label>
              <Input
                id={`quantidade-${side}`}
                inputMode="numeric"
                autoComplete="off"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={!askedOk || busy}>
                Resgatar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}
