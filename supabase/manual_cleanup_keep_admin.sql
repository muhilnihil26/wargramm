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
