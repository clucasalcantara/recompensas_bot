CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS content_cards (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,
  intensity_level SMALLINT NOT NULL CHECK (intensity_level IN (1, 2, 3)),
  emotional_depth TEXT NOT NULL CHECK (emotional_depth IN ('light', 'moderate', 'deep')),
  sexual_content TEXT NOT NULL CHECK (sexual_content IN ('none', 'suggestive', 'sensual', 'explicit')),
  interaction_type TEXT NOT NULL,
  romantic_intensity TEXT NOT NULL CHECK (romantic_intensity IN ('low', 'medium', 'high')),
  requires_mutual BOOLEAN NOT NULL,
  source_reference TEXT NOT NULL,
  source_url TEXT,
  content_status TEXT NOT NULL CHECK (content_status IN ('draft', 'review', 'approved', 'active', 'disabled')),
  origin TEXT NOT NULL,
  embedding vector(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_cards_filter
  ON content_cards (content_status, intensity_level, sexual_content);

CREATE INDEX IF NOT EXISTS content_cards_embedding
  ON content_cards USING hnsw (embedding vector_cosine_ops);
