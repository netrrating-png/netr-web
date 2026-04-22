-- Grant anon/authenticated read access to league tables.
-- PostgREST requires explicit role grants in addition to RLS policies.
grant select on leagues              to anon, authenticated;
grant select on league_teams         to anon, authenticated;
grant select on league_players       to anon, authenticated;
grant select on league_games         to anon, authenticated;
grant select on league_player_stats  to anon, authenticated;
grant select on league_standings     to anon, authenticated;
