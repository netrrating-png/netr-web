alter table league_gallery_photos
  add column if not exists is_featured boolean not null default false;
