-- Follow requests for private accounts
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id)
);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see relevant follow requests"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users can request to follow"
  ON public.follow_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Target can update follow request"
  ON public.follow_requests FOR UPDATE
  USING (auth.uid() = target_id);

CREATE POLICY "Requester or target can delete request"
  ON public.follow_requests FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE TRIGGER trg_follow_requests_updated
  BEFORE UPDATE ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is X following Y? (used by RLS, so SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_following(_follower uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = _follower AND following_id = _target
  );
$$;

-- Posts: optional video + visibility
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Reels: visibility
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Replace existing public-everyone SELECT with privacy-aware version
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.posts;
CREATE POLICY "Posts visible by privacy"
  ON public.posts FOR SELECT
  USING (
    visibility = 'public'
    OR auth.uid() = user_id
    OR public.is_following(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Reels viewable by everyone" ON public.reels;
CREATE POLICY "Reels visible by privacy"
  ON public.reels FOR SELECT
  USING (
    visibility = 'public'
    OR auth.uid() = user_id
    OR public.is_following(auth.uid(), user_id)
  );