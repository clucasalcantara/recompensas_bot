CREATE TABLE IF NOT EXISTS mesa (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  heat INTEGER NOT NULL DEFAULT 1 CHECK (heat IN (1, 2, 3)),
  kind TEXT,
  phase TEXT NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle', 'role', 'writing', 'card')),
  actor TEXT CHECK (actor IS NULL OR actor IN ('lucas', 'gi')),
  cara TEXT CHECK (cara IS NULL OR cara IN ('lucas', 'gi')),
  title TEXT,
  line TEXT,
  offline BOOLEAN NOT NULL DEFAULT FALSE,
  turn TEXT CHECK (turn IS NULL OR turn IN ('lucas', 'gi')),
  lucas_seen BIGINT,
  gi_seen BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mesa (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
