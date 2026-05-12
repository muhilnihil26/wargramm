
-- =========================================================
-- 1. STORAGE POLICIES (fixes story upload RLS error)
-- =========================================================

-- Helper: user folder convention is `<user_id>/...`
-- Stories bucket
CREATE POLICY "Users upload own stories"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own stories"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Posts bucket
CREATE POLICY "Users upload own posts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own posts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Reels bucket
CREATE POLICY "Users upload own reels"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own reels"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars bucket
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Chat images bucket
CREATE POLICY "Users upload own chat images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Verifications bucket
CREATE POLICY "Users upload own verifications"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verifications' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own verifications"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verifications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================
-- 2. COINS
-- =========================================================
CREATE TABLE public.user_coins (
  user_id uuid PRIMARY KEY,
  balance int NOT NULL DEFAULT 0,
  last_login_bonus_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own coins" ON public.user_coins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own coins row" ON public.user_coins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own coins" ON public.user_coins FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount int NOT NULL,
  reason text NOT NULL, -- 'login_bonus' | 'post_reward' | 'reel_reward' | 'coupon_redeem' | 'admin_grant'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own coin tx" ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own coin tx" ON public.coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 3. COUPONS
-- =========================================================
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  brand text,
  code text NOT NULL,
  cost_coins int NOT NULL DEFAULT 100,
  stock int NOT NULL DEFAULT 100,
  image_url text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons viewable by everyone" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins insert coupons" ON public.coupons FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update coupons" ON public.coupons FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete coupons" ON public.coupons FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  code_snapshot text NOT NULL,
  cost_coins int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own redemptions" ON public.coupon_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users redeem coupons" ON public.coupon_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 4. ACCOUNT TYPE on profiles
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';

CREATE OR REPLACE FUNCTION public.validate_account_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_type NOT IN ('personal','business','developer') THEN
    RAISE EXCEPTION 'Invalid account_type: %', NEW.account_type;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS validate_account_type_trigger ON public.profiles;
CREATE TRIGGER validate_account_type_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_type();

-- =========================================================
-- 5. SEED admin settings for coin economy + auth callback
-- =========================================================
INSERT INTO public.admin_settings (key, value) VALUES
  ('coins_post_reward', '5'),
  ('coins_reel_reward', '10'),
  ('coins_login_bonus', '100'),
  ('auth_callback_url', 'https://wargram.lovable.app/api/auth/callback')
ON CONFLICT DO NOTHING;
