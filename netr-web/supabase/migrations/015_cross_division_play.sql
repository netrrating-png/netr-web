alter table leagues
  add column if not exists cross_division_play boolean not null default true;
