-- Add lyrics support to music table
ALTER TABLE public.music 
  ADD COLUMN IF NOT EXISTS lyrics jsonb,
  ADD COLUMN IF NOT EXISTS artist text,
  ADD COLUMN IF NOT EXISTS duration integer;

-- Add lyrics directly on posts/reels for per-track overrides
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS lyrics jsonb;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS lyrics jsonb;