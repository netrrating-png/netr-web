-- Commissioner-chosen display font + sign-up CTA for public league page
alter table leagues
  add column if not exists league_font   text default 'barlow',
  add column if not exists signup_url    text,
  add column if not exists signup_label  text;
