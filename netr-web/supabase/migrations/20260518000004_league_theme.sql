alter table leagues
  add column if not exists league_theme text not null default 'dark'
    check (league_theme in ('dark','light'));
