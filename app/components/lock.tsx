"use client";

import { useState } from "react";
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
    <section className="shell lock">
      <div className="mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="eyebrow">a casa</p>
      <h1>Só vocês dois.</h1>
      <p className="lede">A escada, os jogos, o jantar e a história que o bot vai aprendendo.</p>
      <form
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
        <p className="label">Quem entra?</p>
        <div className="who">
          {[names.lucasName, names.giName].map((name) => (
            <button
              key={name}
              type="button"
              className={person === name ? "on" : undefined}
              aria-pressed={person === name}
              onClick={() => setPerson(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          Entrar
        </button>
        <p className="error" role="alert">
          {error}
        </p>
      </form>
    </section>
  );
}
