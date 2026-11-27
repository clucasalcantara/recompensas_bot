"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    <section className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">Nós</p>
        <h1 className="font-display text-4xl leading-none">A história.</h1>
        <p className="max-w-sm text-muted-foreground">
          O que vocês escreverem aqui o bot usa no Telegram. Os dois podem completar, e os dois podem apagar.
        </p>
      </header>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">O que a casa guarda</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  apply(await api<House>("story", { topic, note: story }));
                  setStory("");
                });
              }}
            >
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
                    <SelectItem value="historia">A nossa história</SelectItem>
                    <SelectItem value="apelido">Apelidos</SelectItem>
                    <SelectItem value="jantar">Jantar</SelectItem>
                    <SelectItem value="noite">As noites</SelectItem>
                    <SelectItem value="ritual">Rituais</SelectItem>
                    <SelectItem value="voz">Como o bot fala</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="story">Conta</Label>
                <Textarea
                  id="story"
                  rows={4}
                  maxLength={400}
                  placeholder="A gente se conheceu… o que a gente gosta de cozinhar… como quer que o bot fale."
                  value={story}
                  onChange={(event) => setStory(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                Guardar
              </Button>
            </form>
          </CardContent>
        </Card>
        <NoteList
          empty="A casa ainda não tem história escrita."
          items={house.stories.map((item) => ({
            id: item.id,
            title: `${item.author} · ${item.topicLabel}`,
            text: item.note,
          }))}
          onForget={(id) => run(async () => apply(await api<House>("forget", { type: "story", id })))}
        />
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Gostos e limites</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  apply(await api<House>("pref", { about, kind, note: pref }));
                  setPref("");
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sobre</Label>
                  <Select value={about} onValueChange={setAbout}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
                      <SelectItem value="me">Eu</SelectItem>
                      <SelectItem value="partner">A outra pessoa</SelectItem>
                      <SelectItem value="couple">Os dois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>É</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
                      <SelectItem value="gosta">gosta</SelectItem>
                      <SelectItem value="evita">não quer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref">O quê</Label>
                <Input
                  id="pref"
                  maxLength={180}
                  placeholder="beijo demorado, nada apressado"
                  value={pref}
                  onChange={(event) => setPref(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                Anotar
              </Button>
            </form>
          </CardContent>
        </Card>
        <NoteList
          empty="Nenhum gosto ou limite anotado."
          items={house.prefs.map((item) => ({
            id: item.id,
            title: `${item.aboutName} ${item.kind === "gosta" ? "gosta" : "não quer"}`,
            text: `${item.note} · dito por ${item.author}`,
          }))}
          onForget={(id) => run(async () => apply(await api<House>("forget", { type: "pref", id })))}
        />
      </div>
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
  if (items.length === 0) return <p className="px-1 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/8">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{item.title}</p>
            <p>{item.text}</p>
          </div>
          <Button type="button" variant="ghost" className="h-9 shrink-0 px-3" onClick={() => void onForget(item.id)}>
            tirar
          </Button>
        </li>
      ))}
    </ul>
  );
}
