-- Cloud-backed user ringtone preference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_ringtone text DEFAULT 'wargram';

-- Admin-managed ads that can appear between reels
CREATE TABLE IF NOT EXISTS public.reel_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  target_url text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reel_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active reel ads viewable by users" ON public.reel_ads;
CREATE POLICY "Active reel ads viewable by users"
ON public.reel_ads FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins insert reel ads" ON public.reel_ads;
CREATE POLICY "Admins insert reel ads"
ON public.reel_ads FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update reel ads" ON public.reel_ads;
CREATE POLICY "Admins update reel ads"
ON public.reel_ads FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete reel ads" ON public.reel_ads;
CREATE POLICY "Admins delete reel ads"
ON public.reel_ads FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Moderation metadata so admins can remove videos with a visible reason
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_by uuid,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_by uuid,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

DROP POLICY IF EXISTS "Reels visible by privacy" ON public.reels;
CREATE POLICY "Reels visible by privacy"
ON public.reels FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    COALESCE(is_removed, false) = false
    AND (
      auth.uid() = user_id
      OR visibility = 'public'
      OR public.is_following(auth.uid(), user_id)
      OR (
        visibility IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = reels.user_id AND COALESCE(p.is_private, false) = true
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Posts visible by privacy" ON public.posts;
CREATE POLICY "Posts visible by privacy"
ON public.posts FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    COALESCE(is_removed, false) = false
    AND (
      auth.uid() = user_id
      OR visibility = 'public'
      OR public.is_following(auth.uid(), user_id)
      OR (
        visibility IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = posts.user_id AND COALESCE(p.is_private, false) = true
        )
      )
    )
  )
);

INSERT INTO public.admin_settings (key, value)
VALUES
  ('reels_copyright_notice', 'Copyrighted or harmful videos may be removed by admin.'),
  ('reel_ads_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
