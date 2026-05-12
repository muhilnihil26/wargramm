CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens"
ON public.push_tokens FOR SELECT
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens"
ON public.push_tokens FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens"
ON public.push_tokens FOR UPDATE
USING (auth.uid()::text = user_id);

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.register_push_token(_user_id text, _token text, _platform text DEFAULT 'web')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(_user_id, '') = '' OR coalesce(_token, '') = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.push_tokens (user_id, token, platform)
  VALUES (_user_id, _token, coalesce(nullif(_platform, ''), 'web'))
  ON CONFLICT (token) DO UPDATE
  SET user_id = excluded.user_id,
      platform = excluded.platform,
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_token(text, text, text) TO anon, authenticated;
