-- Link league games to NETR courts
-- This lets the app show league games on court pages with a distinct "League Game" badge

alter table leagues
  add column if not exists default_court_id uuid references courts(id);

alter table league_games
  add column if not exists court_id uuid references courts(id);

create index if not exists league_games_court_idx on league_games(court_id);
