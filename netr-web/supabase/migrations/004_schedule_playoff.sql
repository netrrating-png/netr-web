-- Add playoff tracking to league_games
alter table league_games
  add column if not exists game_type          text not null default 'regular',
  add column if not exists playoff_round      int,
  add column if not exists playoff_bracket_slot int;

-- Add schedule & playoff config to leagues
alter table leagues
  add column if not exists games_per_team   int  not null default 10,
  add column if not exists playoff_teams    int  not null default 4,
  add column if not exists playoff_format   text not null default 'single_elimination';

-- Add team availability (which days of week can they play)
-- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
alter table league_teams
  add column if not exists available_days int[] not null default '{0,1,2,3,4,5,6}';

-- Update standings view to exclude playoff games
create or replace view league_standings as
select
  t.league_id,
  t.id as team_id,
  t.name as team_name,
  t.color,
  t.logo_url,
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
  and (g.game_type = 'regular' or g.game_type is null)
group by t.league_id, t.id, t.name, t.color, t.logo_url
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

-- Storage bucket for league logos
-- Run this AFTER the tables are set up:
-- insert into storage.buckets (id, name, public) values ('league-logos', 'league-logos', true) on conflict do nothing;
-- create policy "league_logos_select" on storage.objects for select using (bucket_id = 'league-logos');
-- create policy "league_logos_insert" on storage.objects for insert with check (bucket_id = 'league-logos' and auth.role() = 'authenticated');
-- create policy "league_logos_update" on storage.objects for update using (bucket_id = 'league-logos' and auth.role() = 'authenticated');
