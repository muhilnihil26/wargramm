-- WarGram cloud repair + requested cleanup
-- Run this in Supabase SQL Editor for project gggfjptfouiniexrouwk.
-- This fixes YouTube/media schema sync, keeps admin, deletes all posts and reels.

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

-- Requested cleanup starts here.
-- Destructive cleanup requested by admin.
-- Run manually in Supabase SQL Editor only when you are ready.
-- This deletes all posts and reels, then removes non-admin profile rows.
-- It cannot delete Firebase Authentication users; remove those from Firebase Console if needed.

BEGIN;

-- Delete all post/reel media rows and dependent likes/comments/saves through CASCADE where configured.
TRUNCATE TABLE public.posts CASCADE;
TRUNCATE TABLE public.reels CASCADE;

-- Keep admin by configured email and by known Firebase UID string if the mirror table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'firebase_profiles'
  ) THEN
    DELETE FROM public.firebase_profiles
    WHERE coalesce(email, '') <> 'muhilsiddhesh.in@gmail.com'
      AND coalesce(firebase_uid, '') <> 'nxANfkUL63MSTv300eH6rSICw9w1';
  ELSE
    RAISE NOTICE 'public.firebase_profiles table does not exist, so Firebase profile cleanup was skipped.';
  END IF;
END $$;

-- Delete Supabase profile rows except matching admin email if the email column exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE NOTICE 'public.profiles table does not exist, so profile cleanup was skipped.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    DELETE FROM public.profiles
    WHERE coalesce(email, '') <> 'muhilsiddhesh.in@gmail.com';
  ELSE
    RAISE NOTICE 'profiles.email column does not exist, so public.profiles user cleanup was skipped.';
  END IF;
END $$;

-- Remove stored media objects for posts/reels buckets.
DELETE FROM storage.objects WHERE bucket_id IN ('posts', 'reels');

NOTIFY pgrst, 'reload schema';

COMMIT;

