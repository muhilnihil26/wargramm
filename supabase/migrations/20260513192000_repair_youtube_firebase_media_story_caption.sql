-- Repair migration for current production schema-cache errors.
-- Fixes:
-- - YouTube library client cloud sync table
-- - missing stories.caption
-- - missing Firebase owner columns on posts/reels/stories
-- - refresh PostgREST schema cache

CREATE TABLE IF NOT EXISTS public.youtube_library_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  url text NOT NULL,
  title text NOT NULL DEFAULT 'Saved video',
  thumbnail_url text,
  trim_start integer NOT NULL DEFAULT 0,
  trim_end integer NOT NULL DEFAULT 60,
  is_playlist boolean NOT NULL DEFAULT false,
  playlist_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_library_client_uid_created
  ON public.youtube_library_client(firebase_uid, created_at DESC);

ALTER TABLE public.youtube_library_client ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client youtube library read" ON public.youtube_library_client;
CREATE POLICY "Client youtube library read"
  ON public.youtube_library_client FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Client youtube library insert" ON public.youtube_library_client;
CREATE POLICY "Client youtube library insert"
  ON public.youtube_library_client FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL AND length(firebase_uid) > 0);

DROP POLICY IF EXISTS "Client youtube library update" ON public.youtube_library_client;
CREATE POLICY "Client youtube library update"
  ON public.youtube_library_client FOR UPDATE
  USING (true)
  WITH CHECK (firebase_uid IS NOT NULL AND length(firebase_uid) > 0);

DROP POLICY IF EXISTS "Client youtube library delete" ON public.youtube_library_client;
CREATE POLICY "Client youtube library delete"
  ON public.youtube_library_client FOR DELETE
  USING (true);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS firebase_email text,
  ADD COLUMN IF NOT EXISTS firebase_display_name text,
  ADD COLUMN IF NOT EXISTS firebase_photo_url text;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS firebase_email text,
  ADD COLUMN IF NOT EXISTS firebase_display_name text,
  ADD COLUMN IF NOT EXISTS firebase_photo_url text;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS is_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS firebase_email text,
  ADD COLUMN IF NOT EXISTS firebase_display_name text,
  ADD COLUMN IF NOT EXISTS firebase_photo_url text;

ALTER TABLE public.posts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.reels ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.stories ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_firebase_uid_created ON public.posts(firebase_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_firebase_uid_created ON public.reels(firebase_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_firebase_uid_created ON public.stories(firebase_uid, created_at DESC);

DROP POLICY IF EXISTS "Firebase users can create posts" ON public.posts;
CREATE POLICY "Firebase users can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Firebase users can create reels" ON public.reels;
CREATE POLICY "Firebase users can create reels"
  ON public.reels FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Firebase users can create stories" ON public.stories;
CREATE POLICY "Firebase users can create stories"
  ON public.stories FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Firebase users upload media" ON storage.objects;
CREATE POLICY "Firebase users upload media"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id IN ('posts', 'reels', 'stories')
    AND coalesce((storage.foldername(name))[1], '') <> ''
  );

NOTIFY pgrst, 'reload schema';
