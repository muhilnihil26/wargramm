-- Function: admin can grant coins to a single user or all users
CREATE OR REPLACE FUNCTION public.admin_grant_coins(_amount integer, _reason text, _target_user uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  -- Only admins
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'Amount must be non-zero';
  END IF;

  IF _target_user IS NOT NULL THEN
    -- Ensure row
    INSERT INTO public.user_coins (user_id, balance)
    VALUES (_target_user, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_coins
       SET balance = balance + _amount,
           updated_at = now()
     WHERE user_id = _target_user;

    INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
    VALUES (_target_user, _amount, COALESCE(_reason, 'admin_grant'), jsonb_build_object('granted_by', auth.uid()));

    affected := 1;
  ELSE
    -- All users with profiles
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
    SELECT user_id, _amount, COALESCE(_reason, 'admin_giveaway'), jsonb_build_object('granted_by', auth.uid(), 'broadcast', true)
      FROM public.user_coins;
  END IF;

  RETURN affected;
END;
$$;

-- Ensure unique user_coins for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_coins_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.user_coins ADD CONSTRAINT user_coins_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;