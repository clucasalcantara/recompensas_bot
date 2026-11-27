CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  minutes INTEGER NOT NULL,
  note TEXT,
  actor_name TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redemptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('massagem', 'boquete')),
  minutes INTEGER NOT NULL,
  actor_name TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('lucas', 'gi')),
  about TEXT NOT NULL CHECK (about IN ('lucas', 'gi', 'couple')),
  kind TEXT NOT NULL CHECK (kind IN ('gosta', 'evita')),
  note TEXT NOT NULL,
  question TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
