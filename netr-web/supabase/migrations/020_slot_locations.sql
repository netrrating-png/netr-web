-- Per-time-slot location overrides for multi-gym leagues
-- Format: { "1:19:00": "Gym A", "1:20:00": "Gym B", "3:19:00": "Gym C" }
-- Key is "${dayOfWeek}:${time}" where dayOfWeek follows JS convention (0=Sun, 1=Mon…6=Sat)
alter table leagues
  add column if not exists game_slot_locations jsonb;
