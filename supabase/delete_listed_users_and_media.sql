-- Delete the listed old users and their posts/reels/stories from Supabase app data.
-- Run this in Supabase SQL Editor. It keeps admin intact.

BEGIN;

CREATE TEMP TABLE target_delete_emails(email text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO target_delete_emails(email) VALUES
  ('infantjeril442@gmail.com'),
  ('nihilyadesh2015@gmail.com'),
  ('sanjanashreer682@gmail.com'),
  ('mithresh0205@gmail.com'),
  ('yazhinimanikumar@gmail.com'),
  ('mmugeshdharan@gmail.com'),
  ('5b.vrrithikamfts@gmail.com'),
  ('ananya2505123456@gmail.com'),
  ('dharunashok011@gmail.com'),
  ('tamilselvanask7@gmail.com');

DELETE FROM public.posts
WHERE lower(coalesce(firebase_email, '')) IN (SELECT email FROM target_delete_emails);

DELETE FROM public.reels
WHERE lower(coalesce(firebase_email, '')) IN (SELECT email FROM target_delete_emails);

DELETE FROM public.stories
WHERE lower(coalesce(firebase_email, '')) IN (SELECT email FROM target_delete_emails);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'firebase_profiles'
  ) THEN
    DELETE FROM public.firebase_profiles
    WHERE lower(coalesce(email, '')) IN (SELECT email FROM target_delete_emails)
      AND coalesce(email, '') <> 'muhilsiddhesh.in@gmail.com'
      AND coalesce(firebase_uid, '') <> 'nxANfkUL63MSTv300eH6rSICw9w1';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    DELETE FROM public.profiles
    WHERE lower(coalesce(email, '')) IN (SELECT email FROM target_delete_emails)
      AND coalesce(email, '') <> 'muhilsiddhesh.in@gmail.com';
  END IF;
END $$;

DELETE FROM storage.objects
WHERE bucket_id IN ('posts', 'reels', 'stories')
  AND lower((storage.foldername(name))[1]) IN (SELECT email FROM target_delete_emails);

NOTIFY pgrst, 'reload schema';

COMMIT;