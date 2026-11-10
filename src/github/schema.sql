-- STICK ARENA — schema.sql (PostgreSQL no Render)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INT DEFAULT 0, level INT DEFAULT 1, coins INT DEFAULT 300, rating INT DEFAULT 100,
  vitorias INT DEFAULT 0, derrotas INT DEFAULT 0, kills INT DEFAULT 0, assists INT DEFAULT 0,
  dano BIGINT DEFAULT 0, tempo BIGINT DEFAULT 0, partidas INT DEFAULT 0, melhor_pos INT DEFAULT 0,
  owned TEXT[] DEFAULT ARRAY['padrao'], equip JSONB DEFAULT '{"rastro":null,"acessorio":null,"pele":null}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY, modo TEXT NOT NULL, arena TEXT NOT NULL,
  winner_id INT REFERENCES users(id), placar JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_rating ON profiles (rating DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches (created_at DESC);
