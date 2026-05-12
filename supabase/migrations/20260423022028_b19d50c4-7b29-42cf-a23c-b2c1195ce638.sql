ALTER TABLE public.youtube_library
  ADD COLUMN IF NOT EXISTS is_playlist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS playlist_id text;