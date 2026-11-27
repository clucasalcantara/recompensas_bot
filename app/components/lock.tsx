"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { House, Names } from "../types";
import { ApiError, api } from "./api";

export function Lock({
  names,
  busy,
  run,
  onEnter,
}: {
  names: Names;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<boolean>;
  onEnter: (house: House) => void;
}) {
  const [person, setPerson] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="mb-8 flex gap-2" aria-hidden="true">
        <span className="h-4 w-7 rounded-t-md rounded-b-sm bg-gi" />
        <span className="h-4 w-7 -translate-y-2 rounded-t-md rounded-b-sm bg-ring" />
        <span className="h-4 w-7 rounded-t-md rounded-b-sm bg-caio" />
      </div>
      <p className="text-xs tracking-[0.18em] text-primary">Nosso Cantinho</p>
      <h1 className="font-display mt-3 text-5xl leading-none">Só vocês dois.</h1>
      <p className="mt-4 text-muted-foreground">O cantinho de vocês, com a escada e o resto da noite.</p>
      <form
        className="mt-10 space-y-5 rounded-3xl bg-card p-6 shadow-sm ring-1 ring-foreground/8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!person) {
            setError("Escolhe quem é você.");
            return;
          }
          setError("");
          void run(async () => {
            try {
              const house = await api<House>("login", { name: person, password });
              setPassword("");
              onEnter(house);
            } catch (caught) {
              if (caught instanceof ApiError && caught.auth) {
                setError(caught.message);
                return;
              }
              throw caught;
            }
          });
        }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Quem entra?</p>
          <div className="grid grid-cols-2 gap-3">
            {[names.lucasName, names.giName].map((name) => (
              <Button
                key={name}
                type="button"
                variant={person === name ? "default" : "outline"}
                aria-pressed={person === name}
                onClick={() => setPerson(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Entrar
        </Button>
        <p className="min-h-5 text-sm text-destructive" role="alert">
          {error}
        </p>
      </form>
    </section>
  );
}
