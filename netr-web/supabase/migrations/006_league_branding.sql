-- League public page branding: banner image + accent color
alter table leagues
  add column if not exists banner_url   text,
  add column if not exists accent_color text;
