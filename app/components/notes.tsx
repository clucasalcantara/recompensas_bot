"use client";

import { useState } from "react";
import type { House } from "../types";
import { api } from "./api";

export function NotesView({
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
  const [topic, setTopic] = useState("historia");
  const [story, setStory] = useState("");
  const [about, setAbout] = useState("me");
  const [kind, setKind] = useState("gosta");
  const [pref, setPref] = useState("");

  return (
    <section>
      <p className="lede">
        O que vocês escreverem aqui o bot usa no Telegram. Os dois podem completar, e os dois podem apagar.
      </p>
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            apply(await api<House>("story", { topic, note: story }));
            setStory("");
          });
        }}
      >
        <h2>A nossa história</h2>
        <label className="field">
          <span>Assunto</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="historia">A nossa história</option>
            <option value="apelido">Apelidos</option>
            <option value="jantar">Jantar</option>
            <option value="noite">As noites</option>
            <option value="ritual">Rituais</option>
            <option value="voz">Como o bot fala</option>
          </select>
        </label>
        <label className="field">
          <span>Conta</span>
          <textarea
            rows={3}
            maxLength={400}
            placeholder="A gente se conheceu… o que a gente gosta de cozinhar… como quer que o bot fale."
            value={story}
            onChange={(event) => setStory(event.target.value)}
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          Guardar
        </button>
      </form>
      <NoteList
        empty="A casa ainda não tem história escrita."
        items={house.stories.map((item) => ({
          id: item.id,
          title: `${item.author} · ${item.topicLabel}`,
          text: item.note,
        }))}
        onForget={(id) => run(async () => apply(await api<House>("forget", { type: "story", id })))}
      />
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            apply(await api<House>("pref", { about, kind, note: pref }));
            setPref("");
          });
        }}
      >
        <h2>Gostos e limites</h2>
        <div className="row">
          <label className="field grow">
            <span>Sobre</span>
            <select value={about} onChange={(event) => setAbout(event.target.value)}>
              <option value="me">Eu</option>
              <option value="partner">A outra pessoa</option>
              <option value="couple">Os dois</option>
            </select>
          </label>
          <label className="field grow">
            <span>É</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="gosta">gosta</option>
              <option value="evita">não quer</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>O quê</span>
          <input
            maxLength={180}
            placeholder="beijo demorado, nada apressado"
            value={pref}
            onChange={(event) => setPref(event.target.value)}
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          Anotar
        </button>
      </form>
      <NoteList
        empty="Nenhum gosto ou limite anotado."
        items={house.prefs.map((item) => ({
          id: item.id,
          title: `${item.aboutName} ${item.kind === "gosta" ? "gosta" : "não quer"}`,
          text: `${item.note} · dito por ${item.author}`,
        }))}
        onForget={(id) => run(async () => apply(await api<House>("forget", { type: "pref", id })))}
      />
    </section>
  );
}

function NoteList({
  items,
  empty,
  onForget,
}: {
  items: { id: number; title: string; text: string }[];
  empty: string;
  onForget: (id: number) => Promise<boolean>;
}) {
  return (
    <ul className="notes">
      {items.length === 0 ? <li className="note">{empty}</li> : null}
      {items.map((item) => (
        <li className="note" key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
          <button type="button" onClick={() => void onForget(item.id)}>
            tirar
          </button>
        </li>
      ))}
    </ul>
  );
}
