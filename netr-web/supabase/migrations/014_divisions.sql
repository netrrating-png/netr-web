-- ============================================================
-- NETR League Divisions
-- ============================================================

-- 1. LEAGUE DIVISIONS
create table if not exists league_divisions (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references leagues(id) on delete cascade,
  name          text not null,
  display_order int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists league_divisions_league_idx on league_divisions(league_id);

alter table league_divisions enable row level security;

create policy "divisions_select" on league_divisions for select using (true);
create policy "divisions_insert" on league_divisions for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "divisions_update" on league_divisions for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "divisions_delete" on league_divisions for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- 2. ADD division_id TO league_teams (nullable for backward compat)
alter table league_teams
  add column if not exists division_id uuid references league_divisions(id) on delete set null;

-- 3. ADD division_id TO league_games (nullable, set when generating division schedule)
alter table league_games
  add column if not exists division_id uuid references league_divisions(id) on delete set null;

-- 4. UPDATE league_standings view to expose division_id so frontend can filter
create or replace view league_standings as
select
  t.league_id,
  t.id          as team_id,
  t.name        as team_name,
  t.color,
  t.division_id,
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
  and (g.division_id = t.division_id or g.division_id is null)
group by t.league_id, t.id, t.name, t.color, t.division_id
order by
  count(*) filter (
    where (g.home_team_id = t.id and g.home_score > g.away_score)
       or (g.away_team_id = t.id and g.away_score > g.home_score)
  ) desc,
  (
    coalesce(sum(case when g.home_team_id = t.id then g.home_score
                      when g.away_team_id = t.id then g.away_score end), 0) -
    coalesce(sum(case when g.home_team_id = t.id then g.away_score
                      when g.away_team_id = t.id then g.home_score end), 0)
  ) desc;
