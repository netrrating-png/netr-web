-- Announcement text the commissioner can post on their public league page
alter table leagues
  add column if not exists announcement text;
