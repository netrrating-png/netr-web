-- Contact info and social links on leagues
alter table leagues
  add column if not exists contact_info text,
  add column if not exists social_links jsonb;

-- Sponsors
create table if not exists league_sponsors (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references leagues(id) on delete cascade,
  name           text not null,
  logo_url       text,
  website_url    text,
  display_order  int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists sponsors_league_idx on league_sponsors(league_id);
alter table league_sponsors enable row level security;
create policy "sponsors_select" on league_sponsors for select using (true);
create policy "sponsors_all"    on league_sponsors for all   using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
grant select on league_sponsors to anon, authenticated;
grant insert, update, delete on league_sponsors to authenticated;

-- Gallery photos
create table if not exists league_gallery_photos (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references leagues(id) on delete cascade,
  photo_url   text not null,
  caption     text,
  created_at  timestamptz not null default now()
);
create index if not exists gallery_league_idx on league_gallery_photos(league_id);
alter table league_gallery_photos enable row level security;
create policy "gallery_select" on league_gallery_photos for select using (true);
create policy "gallery_all"    on league_gallery_photos for all   using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
grant select on league_gallery_photos to anon, authenticated;
grant insert, delete on league_gallery_photos to authenticated;
