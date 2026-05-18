-- ============================================================
-- League App Accounts
-- Adds league identity columns to profiles so a league owner
-- can create a dedicated NETR app account for their league.
-- The app routes to a league-specific experience when
-- is_league_account = true.
-- ============================================================

-- 1. Mark which profiles are league accounts
alter table profiles
  add column if not exists is_league_account boolean not null default false,
  add column if not exists league_id         uuid references leagues(id) on delete cascade;

-- 2. Back-reference on leagues so we can quickly find the league's app profile
alter table leagues
  add column if not exists app_account_id uuid references profiles(id) on delete set null;

-- 3. Indexes
create index if not exists idx_profiles_league_id
  on profiles(league_id) where league_id is not null;

create index if not exists idx_profiles_is_league_account
  on profiles(is_league_account) where is_league_account = true;

create index if not exists idx_leagues_app_account_id
  on leagues(app_account_id) where app_account_id is not null;
