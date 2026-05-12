-- Store searchable email on profiles so user search/admin lists work across devices.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '');

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS profiles_full_name_idx ON public.profiles (lower(full_name));

-- Remove duplicate display-name profiles, keeping any row that says "dont delete me".
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(trim(coalesce(nullif(full_name, ''), username)))
      ORDER BY
        CASE
          WHEN lower(coalesce(username, '') || ' ' || coalesce(full_name, '') || ' ' || coalesce(bio, '')) LIKE '%dont delete me%'
            OR lower(coalesce(username, '') || ' ' || coalesce(full_name, '') || ' ' || coalesce(bio, '')) LIKE '%don''t delete me%'
          THEN 0 ELSE 1
        END,
        created_at DESC
    ) AS rn
  FROM public.profiles
  WHERE coalesce(nullif(full_name, ''), username) IS NOT NULL
)
DELETE FROM public.profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- Firebase-admin compatible coin grant. The web app uses Firebase auth, so auth.uid()
-- can be null even for the configured admin.
CREATE OR REPLACE FUNCTION public.admin_grant_coins_client(
  _admin_uid text,
  _amount integer,
  _reason text,
  _target_user uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
  configured_uid text;
BEGIN
  SELECT value INTO configured_uid
  FROM public.admin_settings
  WHERE key = 'firebase_admin_uid'
  LIMIT 1;

  IF NOT (
    (_admin_uid IS NOT NULL AND configured_uid IS NOT NULL AND _admin_uid = configured_uid)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'Amount must be non-zero';
  END IF;

  IF _target_user IS NOT NULL THEN
    INSERT INTO public.user_coins (user_id, balance)
    VALUES (_target_user, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_coins
    SET balance = balance + _amount,
        updated_at = now()
    WHERE user_id = _target_user;

    INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
    VALUES (_target_user, _amount, COALESCE(_reason, 'admin_grant'), jsonb_build_object('granted_by_firebase_uid', _admin_uid));

    affected := 1;
  ELSE
    INSERT INTO public.user_coins (user_id, balance)
    SELECT p.user_id, 0
    FROM public.profiles p
    LEFT JOIN public.user_coins uc ON uc.user_id = p.user_id
    WHERE uc.user_id IS NULL;

    UPDATE public.user_coins
    SET balance = balance + _amount,
        updated_at = now();
    GET DIAGNOSTICS affected = ROW_COUNT;

    INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
    SELECT user_id, _amount, COALESCE(_reason, 'admin_giveaway'), jsonb_build_object('granted_by_firebase_uid', _admin_uid, 'broadcast', true)
    FROM public.user_coins;
  END IF;

  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_coins_client(text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins_client(text, integer, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins(integer, text, uuid) TO anon, authenticated;

-- Let the configured Firebase admin manage admin-only rows without writing
-- the Firebase uid into UUID columns.
ALTER TABLE public.app_notices
  ALTER COLUMN created_by DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS created_by_firebase_uid text;

ALTER TABLE public.user_blocks
  ALTER COLUMN blocked_by DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS blocked_by_firebase_uid text;

ALTER TABLE public.reel_ads
  ADD COLUMN IF NOT EXISTS created_by_firebase_uid text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS removed_by_firebase_uid text;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS removed_by_firebase_uid text;

DROP POLICY IF EXISTS "Admins manage notices ins" ON public.app_notices;
CREATE POLICY "Admins manage notices ins"
ON public.app_notices FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
);

DROP POLICY IF EXISTS "Admins manage notices upd" ON public.app_notices;
CREATE POLICY "Admins manage notices upd"
ON public.app_notices FOR UPDATE
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
)
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
);

DROP POLICY IF EXISTS "Admins manage notices del" ON public.app_notices;
CREATE POLICY "Admins manage notices del"
ON public.app_notices FOR DELETE
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
);

DROP POLICY IF EXISTS "Admins insert reel ads" ON public.reel_ads;
CREATE POLICY "Admins insert reel ads"
ON public.reel_ads FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
);

DROP POLICY IF EXISTS "Admins update reel ads" ON public.reel_ads;
CREATE POLICY "Admins update reel ads"
ON public.reel_ads FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
);

DROP POLICY IF EXISTS "Admins delete reel ads" ON public.reel_ads;
CREATE POLICY "Admins delete reel ads"
ON public.reel_ads FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
);

DROP POLICY IF EXISTS "Configured admin can moderate posts" ON public.posts;
CREATE POLICY "Configured admin can moderate posts"
ON public.posts FOR UPDATE
USING (true)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR removed_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
  OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Configured admin can moderate reels" ON public.reels;
CREATE POLICY "Configured admin can moderate reels"
ON public.reels FOR UPDATE
USING (true)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR removed_by_firebase_uid = (SELECT value FROM public.admin_settings WHERE key = 'firebase_admin_uid' LIMIT 1)
  OR auth.uid() = user_id
);
