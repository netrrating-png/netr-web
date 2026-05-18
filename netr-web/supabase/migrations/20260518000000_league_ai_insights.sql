-- Add playoff_spots to leagues table (how many teams qualify for playoffs)
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_spots INT DEFAULT 4;

-- AI insights table — one row per team per league, upserted after each generation
CREATE TABLE IF NOT EXISTS league_ai_insights (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id               UUID NOT NULL,
  team_id                 UUID NOT NULL,
  playoff_probability     FLOAT NOT NULL DEFAULT 0,
  championship_probability FLOAT NOT NULL DEFAULT 0,
  magic_number            INT,                          -- NULL = eliminated
  trend                   TEXT NOT NULL DEFAULT 'STABLE', -- 'UP' | 'DOWN' | 'STABLE'
  insight_text            TEXT NOT NULL DEFAULT '',
  games_played            INT NOT NULL DEFAULT 0,
  low_confidence          BOOLEAN NOT NULL DEFAULT FALSE, -- true when < 4 games played
  generated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT league_ai_insights_unique UNIQUE (league_id, team_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS league_ai_insights_league_idx ON league_ai_insights (league_id);
CREATE INDEX IF NOT EXISTS league_ai_insights_team_idx  ON league_ai_insights (team_id);

-- RLS: anyone can read, only service role can write
ALTER TABLE league_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights_public_read"
  ON league_ai_insights FOR SELECT USING (true);

CREATE POLICY "insights_service_write"
  ON league_ai_insights FOR ALL USING (auth.role() = 'service_role');

-- Optional: auto-trigger via webhook
-- Set up a Supabase Database Webhook on the league_games table:
--   Table: league_games
--   Event: UPDATE
--   Filter: status = 'final'
--   URL: https://your-domain.com/api/league/{slug}/insights (POST)
--   Headers: x-admin-key: your_ADMIN_PASSWORD value
