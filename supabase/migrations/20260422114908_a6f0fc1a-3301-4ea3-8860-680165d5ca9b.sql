-- 1. Verified badge fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none';
-- 'none' | 'pending' | 'approved' | 'rejected'

-- 2. Verification requests
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_legal_name text NOT NULL,
  category text NOT NULL,           -- e.g. creator, business, public_figure
  reason text,                       -- why they should be verified
  document_url text NOT NULL,        -- ID / proof document
  selfie_url text,
  status text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own verification request"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own verification request"
  ON public.verification_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update verification request"
  ON public.verification_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete verification request"
  ON public.verification_requests FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. YouTube library (per-user saved YouTube video/shorts URLs)
CREATE TABLE IF NOT EXISTS public.youtube_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  thumbnail_url text,
  trim_start integer NOT NULL DEFAULT 0,
  trim_end integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own youtube library"
  ON public.youtube_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users add to own youtube library"
  ON public.youtube_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own youtube library"
  ON public.youtube_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own youtube library"
  ON public.youtube_library FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Verifications storage bucket (public so admins/users can preview)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Verification files publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verifications');

CREATE POLICY "Users upload own verification files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins delete verification files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'verifications' AND public.has_role(auth.uid(), 'admin'));

-- 5. Drop Instagram accounts table (feature removed)
DROP TABLE IF EXISTS public.instagram_accounts CASCADE;