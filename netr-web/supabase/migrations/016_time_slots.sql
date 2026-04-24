-- Add commissioner-defined time slots to leagues
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS game_time_slots text[];

-- Add per-team time slot availability
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS available_times text[];
