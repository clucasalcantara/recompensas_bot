"use client";

import { useState } from "react";
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
    <section>
      <p className="lede">A escada de vocês, os jogos, e o que a casa já sabe.</p>
      <div className="pair">
        <Person
          name={house.lucasName}
          side="lucas"
          data={house.lucas}
          prize="mamadinha"
          cycle={house.cycleMinutes}
        />
        <Person name={house.giName} side="gi" data={house.gi} prize="massagem" cycle={house.cycleMinutes} />
      </div>
      <StairChart house={house} />
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            apply(await api<House>("log", { minutes, note }));
            setMinutes("");
            setNote("");
          });
        }}
      >
        <h2>Subi a escada</h2>
        <p className="hint">Entra na escada de {house.you}.</p>
        <div className="row">
          <label className="field grow">
            <span>Minutos</span>
            <input inputMode="numeric" autoComplete="off" placeholder="40" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
          </label>
          <label className="field grow">
            <span>Nota</span>
            <input
              maxLength={120}
              placeholder="de noite, sem pressa"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
        <button className="primary" type="submit" disabled={busy}>
          Lançar
        </button>
      </form>
      <section className="panel">
        <h2>Prêmios</h2>
        <p className="hint">Os ciclos acumulam. Dá pra levar tudo ou só uma parte.</p>
        <div className="prizes">
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
        </div>
      </section>
      <section className="panel">
        <h2>Últimos passos</h2>
        <ul className="list">
          {house.recent.length === 0 ? <li>Nada lançado ainda.</li> : null}
          {house.recent.map((event) => (
            <li key={`${event.when}-${event.text}`}>
              <span>{event.text}</span>
              <span>{event.when}</span>
            </li>
          ))}
        </ul>
      </section>
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
    <article className={`person ${side}`}>
      <p className="name">{name}</p>
      <strong>{data.totalMinutes}</strong>
      <p className="small">min de escada</p>
      <div className="meter">
        <span style={{ width: `${width}%` }} />
      </div>
      <p className="small">
        {data.totalMinutes === 0
          ? `Cada ${cycle} min viram ${data.perCycle} min de ${prize}.`
          : `Faltam ${data.minutesToNextCycle} min para o próximo ciclo, que vale ${data.perCycle} min de ${prize}.`}
      </p>
      <p className="small">
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
      className="prize"
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
      <div className="row">
        <input
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
        <button className="primary" type="submit" disabled={!ready || busy}>
          {armed ? "Confirmar" : "Levar"}
        </button>
      </div>
    </form>
  );
}
