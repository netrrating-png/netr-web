-- ============================================================
-- NETR League Dashboard — Table Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. LEAGUES
create table if not exists leagues (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  slug         text unique not null,
  sport        text not null default 'basketball',
  season       text,
  location     text,
  description  text,
  logo_url     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 2. LEAGUE TEAMS
create table if not exists league_teams (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references leagues(id) on delete cascade,
  name         text not null,
  color        text not null default '#39FF14',
  logo_url     text,
  join_token   text unique not null default encode(gen_random_bytes(12), 'hex'),
  created_at   timestamptz not null default now()
);

-- 3. LEAGUE PLAYERS
create table if not exists league_players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references league_teams(id) on delete cascade,
  league_id      uuid not null references leagues(id) on delete cascade,
  profile_id     uuid references profiles(id),
  display_name   text not null,
  jersey_number  text,
  position       text,
  is_claimed     boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists league_players_profile_idx on league_players(profile_id);
create index if not exists league_players_team_idx on league_players(team_id);

-- 4. LEAGUE GAMES
create table if not exists league_games (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references leagues(id) on delete cascade,
  home_team_id   uuid not null references league_teams(id),
  away_team_id   uuid not null references league_teams(id),
  scheduled_at   timestamptz not null,
  location       text,
  status         text not null default 'scheduled'
                   check (status in ('scheduled','final','cancelled')),
  home_score     int,
  away_score     int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists league_games_league_idx on league_games(league_id);

-- 5. LEAGUE PLAYER STATS (box scores)
create table if not exists league_player_stats (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references league_games(id) on delete cascade,
  player_id    uuid not null references league_players(id) on delete cascade,
  team_id      uuid not null references league_teams(id),
  points       int not null default 0,
  rebounds     int not null default 0,
  assists      int not null default 0,
  steals       int not null default 0,
  blocks       int not null default 0,
  turnovers    int not null default 0,
  fouls        int not null default 0,
  unique(game_id, player_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table leagues           enable row level security;
alter table league_teams      enable row level security;
alter table league_players    enable row level security;
alter table league_games      enable row level security;
alter table league_player_stats enable row level security;

-- leagues: owner manages; anyone can read
create policy "leagues_select" on leagues for select using (true);
create policy "leagues_insert" on leagues for insert with check (auth.uid() = owner_id);
create policy "leagues_update" on leagues for update using (auth.uid() = owner_id);
create policy "leagues_delete" on leagues for delete using (auth.uid() = owner_id);

-- league_teams: owner manages via league; anyone reads
create policy "teams_select" on league_teams for select using (true);
create policy "teams_insert" on league_teams for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "teams_update" on league_teams for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "teams_delete" on league_teams for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- league_players: owner manages; anyone reads
create policy "players_select" on league_players for select using (true);
create policy "players_insert" on league_players for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "players_update" on league_players for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
    or auth.uid() = profile_id  -- player can claim their own spot
);
create policy "players_delete" on league_players for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- league_games: owner manages; anyone reads
create policy "games_select" on league_games for select using (true);
create policy "games_insert" on league_games for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "games_update" on league_games for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "games_delete" on league_games for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- league_player_stats: owner manages; anyone reads
create policy "stats_select" on league_player_stats for select using (true);
create policy "stats_insert" on league_player_stats for insert with check (
  auth.uid() = (select owner_id from leagues l
                join league_games g on g.league_id = l.id
                where g.id = game_id)
);
create policy "stats_update" on league_player_stats for update using (
  auth.uid() = (select owner_id from leagues l
                join league_games g on g.league_id = l.id
                where g.id = game_id)
);
create policy "stats_delete" on league_player_stats for delete using (
  auth.uid() = (select owner_id from leagues l
                join league_games g on g.league_id = l.id
                where g.id = game_id)
);

-- ============================================================
-- STANDINGS VIEW
-- Computes W/L/PF/PA from completed games
-- ============================================================
create or replace view league_standings as
select
  t.league_id,
  t.id as team_id,
  t.name as team_name,
  t.color,
  count(*) filter (
    where (g.home_team_id = t.id and g.home_score > g.away_score)
       or (g.away_team_id = t.id and g.away_score > g.home_score)
  ) as wins,
  count(*) filter (
    where (g.home_team_id = t.id and g.home_score < g.away_score)
       or (g.away_team_id = t.id and g.away_score < g.home_score)
  ) as losses,
  coalesce(sum(case when g.home_team_id = t.id then g.home_score
                    when g.away_team_id = t.id then g.away_score end), 0) as pts_for,
  coalesce(sum(case when g.home_team_id = t.id then g.away_score
                    when g.away_team_id = t.id then g.home_score end), 0) as pts_against
from league_teams t
left join league_games g
  on (g.home_team_id = t.id or g.away_team_id = t.id)
  and g.status = 'final'
group by t.league_id, t.id, t.name, t.color
order by wins desc, (pts_for - pts_against) desc;
