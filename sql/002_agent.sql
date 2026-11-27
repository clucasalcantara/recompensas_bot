CREATE TABLE IF NOT EXISTS messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  user_id BIGINT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_chat_id_id ON messages (chat_id, id DESC);
