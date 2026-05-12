
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS claim_url text,
  ADD COLUMN IF NOT EXISTS claim_instructions text;

INSERT INTO public.admin_settings (key, value)
VALUES
  ('coins_referral_bonus', '50'),
  ('coins_signup_bonus', '100')
ON CONFLICT (key) DO NOTHING;
