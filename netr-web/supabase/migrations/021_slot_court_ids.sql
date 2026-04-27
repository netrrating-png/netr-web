-- Per-time-slot court ID overrides for multi-gym leagues
-- Parallel to game_slot_locations; keyed as "${dayOfWeek}:${time}"
-- When set, the scheduled game gets this court_id → visible to app users at that court
alter table leagues
  add column if not exists game_slot_court_ids jsonb;
