-- ============================================================
-- League Team Crews
-- Each league team gets an auto-created crew in the NETR app.
-- When a player claims their roster spot, they're added to
-- the crew automatically via a trigger.
-- crew_messages gets two new columns so the league account
-- can send typed game-reminder cards into crew chats.
-- ============================================================

-- 1. Store which crew belongs to which team
alter table league_teams
  add column if not exists crew_id text references crews(id) on delete set null;

create index if not exists idx_league_teams_crew_id
  on league_teams(crew_id) where crew_id is not null;

-- 2. crew_messages: add league context for reminder cards
alter table crew_messages
  add column if not exists league_game_id uuid references league_games(id) on delete set null,
  add column if not exists league_id      uuid references leagues(id)      on delete set null;

-- new message_type value: 'league_game_reminder'
-- (existing check constraint is text DEFAULT 'text', no enum, so no alter needed)

-- 3. Trigger: auto-create a crew when a league team is inserted
create or replace function create_crew_for_league_team()
returns trigger language plpgsql security definer as $$
declare
  v_owner_id   uuid;
  v_crew_id    text;
  v_crew_name  text;
begin
  -- Look up the league owner to use as crew creator/admin
  select owner_id into v_owner_id
  from leagues where id = NEW.league_id;

  -- Crew name: "<Team Name> — <League Name>" truncated to 50 chars
  select substring(NEW.name || ' — ' || l.name, 1, 50)
  into v_crew_name
  from leagues l where l.id = NEW.league_id;

  -- Create the crew (is_public=false so outsiders can't find it)
  insert into crews (name, icon, creator_id, admin_id, is_public)
  values (v_crew_name, 'basketball', v_owner_id, v_owner_id, false)
  returning id into v_crew_id;

  -- Write the crew_id back to the team row
  NEW.crew_id := v_crew_id;

  -- Auto-add the league owner as a founding member
  insert into crew_members (crew_id, user_id, is_primary)
  values (v_crew_id, v_owner_id, false)
  on conflict (crew_id, user_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_create_crew_for_league_team on league_teams;
create trigger trg_create_crew_for_league_team
  before insert on league_teams
  for each row execute function create_crew_for_league_team();

-- 4. Trigger: when a player claims their roster spot, add to crew
create or replace function sync_league_player_to_crew()
returns trigger language plpgsql security definer as $$
declare
  v_crew_id text;
begin
  -- Only fire when profile_id is being set (claim event)
  if NEW.profile_id is null then
    return NEW;
  end if;
  if OLD.profile_id is not null and OLD.profile_id = NEW.profile_id then
    return NEW; -- already synced
  end if;

  -- Find the crew for this player's team
  select crew_id into v_crew_id
  from league_teams where id = NEW.team_id;

  if v_crew_id is null then
    return NEW; -- team has no crew yet (shouldn't happen after migration)
  end if;

  -- Add player to crew
  insert into crew_members (crew_id, user_id, is_primary)
  values (v_crew_id, NEW.profile_id, false)
  on conflict (crew_id, user_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_league_player_to_crew on league_players;
create trigger trg_sync_league_player_to_crew
  before update of profile_id on league_players
  for each row execute function sync_league_player_to_crew();

-- 5. View: league games surfaced on the app's courts page
--    iOS queries this by court_id to show upcoming league games
--    alongside regular pickup games, in the league's accent color.
create or replace view league_games_for_courts as
select
  lg.id,
  lg.court_id,
  lg.scheduled_at,
  lg.status,
  lg.home_score,
  lg.away_score,
  l.id            as league_id,
  l.name          as league_name,
  l.accent_color,
  l.logo_url      as league_logo_url,
  l.sport,
  ht.id           as home_team_id,
  ht.name         as home_team_name,
  ht.color        as home_team_color,
  ht.logo_url     as home_team_logo_url,
  at.id           as away_team_id,
  at.name         as away_team_name,
  at.color        as away_team_color,
  at.logo_url     as away_team_logo_url
from league_games lg
join leagues      l  on lg.league_id    = l.id
left join league_teams ht on lg.home_team_id = ht.id
left join league_teams at on lg.away_team_id = at.id
where lg.status    = 'scheduled'
  and lg.court_id  is not null
  and lg.scheduled_at >= now() - interval '2 hours';

-- Grant read access to the anon role (same pattern as other tables)
grant select on league_games_for_courts to anon, authenticated;
