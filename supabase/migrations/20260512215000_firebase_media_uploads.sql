ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS firebase_email text,
  ADD COLUMN IF NOT EXISTS firebase_display_name text,
  ADD COLUMN IF NOT EXISTS firebase_photo_url text,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS firebase_email text,
  ADD COLUMN IF NOT EXISTS firebase_display_name text,
  ADD COLUMN IF NOT EXISTS firebase_photo_url text,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS firebase_email text,
  ADD COLUMN IF NOT EXISTS firebase_display_name text,
  ADD COLUMN IF NOT EXISTS firebase_photo_url text,
  ALTER COLUMN user_id DROP NOT NULL;

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
