
-- Reels table
CREATE TABLE public.reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  caption TEXT,
  music_url TEXT,
  music_title TEXT DEFAULT '',
  music_start INTEGER DEFAULT 0,
  music_end INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reels viewable by everyone" ON public.reels FOR SELECT USING (true);
CREATE POLICY "Users can create own reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reels" ON public.reels FOR DELETE USING (auth.uid() = user_id);

-- Add music columns to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS music_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS music_title TEXT DEFAULT '';

-- Add music columns to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_url TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_title TEXT DEFAULT '';

-- User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin settings table
CREATE TABLE public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by everyone" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert settings" ON public.admin_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings" ON public.admin_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete settings" ON public.admin_settings FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Reels storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true);
CREATE POLICY "Reel videos publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Users can upload reels" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own reels" ON storage.objects FOR DELETE USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Stories storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true) ON CONFLICT (id) DO NOTHING;

-- Seed admin role for the specified email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'muhilsiddhesh.in@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Insert default admin settings
INSERT INTO public.admin_settings (key, value) VALUES
  ('story_time_limit', '15'),
  ('reel_time_limit', '60'),
  ('app_name', 'WarGram'),
  ('primary_color', '340 75% 55%'),
  ('allow_music', 'true')
ON CONFLICT (key) DO NOTHING;

-- Enable realtime for reels
ALTER PUBLICATION supabase_realtime ADD TABLE public.reels;
