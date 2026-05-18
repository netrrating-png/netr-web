alter table leagues
  add column if not exists about_sections jsonb default null;
