-- Notes + secure private-account request approval.

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 80),
  visibility text NOT NULL DEFAULT 'followers' CHECK (visibility IN ('public', 'followers', 'only_me')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notes visible by privacy"
  ON public.notes FOR SELECT
  USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR (visibility = 'followers' AND public.is_following(auth.uid(), user_id))
  );

CREATE POLICY "Users create own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON public.notes(expires_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON public.notes(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;

CREATE OR REPLACE FUNCTION public.accept_follow_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
BEGIN
  SELECT * INTO req
  FROM public.follow_requests
  WHERE id = _request_id AND target_id = auth.uid() AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow request not found or already handled';
  END IF;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (req.requester_id, req.target_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  DELETE FROM public.follow_requests WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (req.requester_id, req.target_id, 'follow_accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_follow_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_follow_request(uuid) TO authenticated;

-- Keep the requested admin seeded whenever migrations run after that user exists.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'muhilsiddhesh.in@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.email = 'muhilsiddhesh.in@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
