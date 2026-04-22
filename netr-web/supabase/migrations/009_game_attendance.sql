-- Player RSVP / game attendance tracking
create table if not exists league_game_attendance (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references league_games(id) on delete cascade,
  player_id  uuid not null references league_players(id) on delete cascade,
  status     text not null check (status in ('yes','no','maybe')),
  updated_at timestamptz not null default now(),
  unique(game_id, player_id)
);

create index if not exists attendance_game_idx on league_game_attendance(game_id);
create index if not exists attendance_player_idx on league_game_attendance(player_id);

alter table league_game_attendance enable row level security;

-- anyone can read attendance (for showing counts on public page)
create policy "attendance_select" on league_game_attendance for select using (true);

-- players update their own rsvp (using profile_id from league_players)
create policy "attendance_upsert" on league_game_attendance for insert with check (
  auth.uid() = (select profile_id from league_players where id = player_id)
);
create policy "attendance_update" on league_game_attendance for update using (
  auth.uid() = (select profile_id from league_players where id = player_id)
);

-- commissioner can also manage attendance
create policy "attendance_delete" on league_game_attendance for delete using (
  auth.uid() = (select owner_id from leagues l
    join league_games g on g.league_id = l.id
    where g.id = game_id)
);

grant select on league_game_attendance to anon, authenticated;
grant insert, update, delete on league_game_attendance to authenticated;
