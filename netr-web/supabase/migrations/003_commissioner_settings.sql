-- Add commissioner-configurable settings to leagues
alter table leagues
  add column if not exists min_games_for_stats  int  not null default 1,
  add column if not exists default_game_location text,
  add column if not exists stat_display         text not null default 'per_game';
  -- stat_display: 'per_game' | 'totals'
