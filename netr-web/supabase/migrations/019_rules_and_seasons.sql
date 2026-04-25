-- Rules sections stored as ordered array of {title, content} objects
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS rules_sections jsonb;

-- Season archive: each row represents one completed season of a league
CREATE TABLE IF NOT EXISTS league_seasons (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name           text NOT NULL,
  start_date     date,
  end_date       date,
  champion_team_id uuid REFERENCES league_teams(id) ON DELETE SET NULL,
  notes          text,
  display_order  int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_seasons_league_id ON league_seasons(league_id);

-- Tag games to a season so history can filter correctly
ALTER TABLE league_games ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES league_seasons(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE league_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read league_seasons" ON league_seasons
  FOR SELECT USING (true);

CREATE POLICY "Owner can manage league_seasons" ON league_seasons
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT ON league_seasons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON league_seasons TO authenticated;
