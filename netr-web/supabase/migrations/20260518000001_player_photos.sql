-- Player photo columns
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS photo_source TEXT DEFAULT 'custom'
  CHECK (photo_source IN ('custom', 'app'));

-- Avatar on profiles (for claimed players whose app photo the owner can use)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Storage bucket for league-owner-uploaded player photos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('player-photos', 'player-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- RLS policies for player-photos bucket
CREATE POLICY "player_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');

CREATE POLICY "player_photos_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'player-photos' AND auth.role() = 'authenticated');

CREATE POLICY "player_photos_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'player-photos' AND auth.role() = 'authenticated');

CREATE POLICY "player_photos_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'player-photos' AND auth.role() = 'authenticated');
