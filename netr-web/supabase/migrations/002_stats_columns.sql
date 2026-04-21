-- ============================================================
-- NETR League Dashboard — Stats Column Migration
-- Run this in your Supabase SQL editor AFTER 001_league_tables.sql
-- ============================================================

-- Add detailed stat columns to league_player_stats
alter table league_player_stats
  add column if not exists three_pointers_made      int not null default 0,
  add column if not exists three_pointers_attempted int not null default 0,
  add column if not exists field_goals_made         int not null default 0,
  add column if not exists field_goals_attempted    int not null default 0,
  add column if not exists free_throws_made         int not null default 0,
  add column if not exists free_throws_attempted    int not null default 0;

-- Add enabled_stats config to leagues
-- Stores the stat keys the commissioner wants to track for this league
alter table leagues
  add column if not exists enabled_stats text[] not null default array['pts','reb','ast','3pm','stl','blk','tov','ftm','fg%','3p%','ft%'];
