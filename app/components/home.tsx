"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [note, setNote] = useState("");

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">Casa</p>
        <h1 className="font-display text-4xl leading-none">A escada.</h1>
        <p className="max-w-sm text-muted-foreground">O que já subiu, o que está esperando, e o lançamento de hoje.</p>
      </header>
      <div className="grid gap-4">
        <Person name={house.lucasName} side="lucas" data={house.lucas} prize="mamadinha" cycle={house.cycleMinutes} />
        <Person name={house.giName} side="gi" data={house.gi} prize="massagem" cycle={house.cycleMinutes} />
      </div>
      <StairChart house={house} />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Subi a escada</CardTitle>
          <CardDescription>Entra na escada de {house.you}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                apply(await api<House>("log", { minutes, note }));
                setMinutes("");
                setNote("");
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="note">Nota</Label>
                <Input
                  id="note"
                  maxLength={120}
                  placeholder="de noite, sem pressa"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              Lançar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Prêmios</CardTitle>
          <CardDescription>Os ciclos acumulam. Dá pra levar tudo ou só uma parte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Prize
            label={`${house.giName}: massagem`}
            available={house.gi.available}
            kind="massagem"
            busy={busy}
            onRedeem={(value) => run(async () => apply(await api<House>("redeem", { kind: "massagem", minutes: value })))}
          />
          <Prize
            label={`${house.lucasName}: mamadinha`}
            available={house.lucas.available}
            kind="boquete"
            busy={busy}
            onRedeem={(value) => run(async () => apply(await api<House>("redeem", { kind: "boquete", minutes: value })))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Últimos passos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {house.recent.length === 0 ? <li className="text-muted-foreground">Nada lançado ainda.</li> : null}
            {house.recent.map((event) => (
              <li key={`${event.when}-${event.text}`} className="flex items-baseline justify-between gap-4">
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
  prize,
  cycle,
}: {
  name: string;
  side: "lucas" | "gi";
  data: Side;
  prize: string;
  cycle: number;
}) {
  const width = data.totalMinutes === 0 ? 0 : Math.round((data.bankMinutes / cycle) * 100);
  return (
    <article className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-foreground/8">
      <p className="text-sm text-muted-foreground">{name}</p>
      <p className={`font-display mt-2 text-5xl leading-none ${side === "lucas" ? "text-caio" : "text-gi"}`}>
        {data.totalMinutes}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">min de escada</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={`block h-full rounded-full ${side === "lucas" ? "bg-caio" : "bg-gi"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {data.totalMinutes === 0
          ? `Cada ${cycle} min viram ${data.perCycle} min de ${prize}.`
          : `Faltam ${data.minutesToNextCycle} min para o próximo ciclo, que vale ${data.perCycle} min de ${prize}.`}
      </p>
      <p className="mt-1 text-sm">
        {data.available > 0 ? `${data.available} min de ${prize} esperando.` : "Nada esperando agora."}
      </p>
    </article>
  );
}

function Prize({
  label,
  available,
  kind,
  busy,
  onRedeem,
}: {
  label: string;
  available: number;
  kind: string;
  busy: boolean;
  onRedeem: (minutes: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [armed, setArmed] = useState(false);
  const ready = available > 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!armed) {
          setArmed(true);
          return;
        }
        const minutes = value || String(available);
        void onRedeem(minutes).then((ok) => {
          if (!ok) return;
          setArmed(false);
          setValue("");
        });
      }}
    >
      <p>{ready ? `${label}, ${available} min disponíveis` : `${label}, nada esperando`}</p>
      <div className="flex gap-3">
        <Input
          inputMode="numeric"
          autoComplete="off"
          placeholder={ready ? String(available) : "0"}
          value={value}
          disabled={!ready}
          aria-label={`Minutos de ${kind}`}
          onChange={(event) => {
            setValue(event.target.value);
            setArmed(false);
          }}
        />
        <Button type="submit" className="shrink-0" disabled={!ready || busy}>
          {armed ? "Confirmar" : "Levar"}
        </Button>
      </div>
    </form>
  );
}
