-- ============================================================
-- League Game Reminders
-- Tracks which reminders have already been sent so the daily
-- cron job never sends a duplicate.
-- ============================================================

create table if not exists league_game_reminders_sent (
  id              uuid        primary key default gen_random_uuid(),
  league_game_id  uuid        not null references league_games(id) on delete cascade,
  team_id         uuid        not null references league_teams(id) on delete cascade,
  crew_id         text        not null,
  sent_at         timestamptz not null default now(),
  unique (league_game_id, team_id)
);

create index if not exists idx_lgrs_game_id
  on league_game_reminders_sent(league_game_id);

-- RLS: only the service role (used by the cron API route) can write;
-- authenticated users can read their own team's reminders.
alter table league_game_reminders_sent enable row level security;

create policy "service role full access"
  on league_game_reminders_sent
  using (true)
  with check (true);
