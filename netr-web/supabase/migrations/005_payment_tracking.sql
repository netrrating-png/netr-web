-- Sprint 1: Per-team payment tracking
-- Team captains pay for the whole team; commissioner tracks which teams have paid.

alter table league_teams
  add column if not exists fee_paid boolean not null default false,
  add column if not exists fee_note text;

alter table leagues
  add column if not exists fee_amount int;
