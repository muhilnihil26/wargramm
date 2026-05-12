-- Coupons: mark affiliate-only
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_affiliate boolean NOT NULL DEFAULT false;

-- Profiles: onboarding flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Admin notices (banners shown to all users)
CREATE TABLE IF NOT EXISTS public.app_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  level text NOT NULL DEFAULT 'info', -- info | warn | success
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notices viewable by everyone" ON public.app_notices;
CREATE POLICY "Notices viewable by everyone" ON public.app_notices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage notices ins" ON public.app_notices;
CREATE POLICY "Admins manage notices ins" ON public.app_notices FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage notices upd" ON public.app_notices;
CREATE POLICY "Admins manage notices upd" ON public.app_notices FOR UPDATE USING (public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage notices del" ON public.app_notices;
CREATE POLICY "Admins manage notices del" ON public.app_notices FOR DELETE USING (public.has_role(auth.uid(),'admin'::app_role));

-- User blocks issued by admins
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason text,
  blocked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User sees own block" ON public.user_blocks;
CREATE POLICY "User sees own block" ON public.user_blocks FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Admins block ins" ON public.user_blocks;
CREATE POLICY "Admins block ins" ON public.user_blocks FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Admins block del" ON public.user_blocks;
CREATE POLICY "Admins block del" ON public.user_blocks FOR DELETE USING (public.has_role(auth.uid(),'admin'::app_role));

-- Voice notes & reply-to for messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to uuid;