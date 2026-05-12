-- Private accounts are never exposed publicly, even if a row says visibility='public'.

DROP POLICY IF EXISTS "Posts visible by privacy" ON public.posts;
CREATE POLICY "Posts visible by privacy"
  ON public.posts FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_following(auth.uid(), user_id)
    OR (
      visibility = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = posts.user_id AND COALESCE(p.is_private, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Reels visible by privacy" ON public.reels;
CREATE POLICY "Reels visible by privacy"
  ON public.reels FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_following(auth.uid(), user_id)
    OR (
      visibility = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = reels.user_id AND COALESCE(p.is_private, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Stories visible by visibility" ON public.stories;
CREATE POLICY "Stories visible by visibility"
ON public.stories
FOR SELECT
USING (
  auth.uid() = user_id
  OR (visibility = 'only_me' AND auth.uid() = user_id)
  OR (visibility = 'followers' AND public.is_following(auth.uid(), user_id))
  OR (
    visibility = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = stories.user_id AND COALESCE(p.is_private, false) = true
    )
  )
);

DROP POLICY IF EXISTS "Notes visible by privacy" ON public.notes;
CREATE POLICY "Notes visible by privacy"
  ON public.notes FOR SELECT
  USING (
    auth.uid() = user_id
    OR (visibility = 'followers' AND public.is_following(auth.uid(), user_id))
    OR (
      visibility = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = notes.user_id AND COALESCE(p.is_private, false) = true
      )
    )
  );
