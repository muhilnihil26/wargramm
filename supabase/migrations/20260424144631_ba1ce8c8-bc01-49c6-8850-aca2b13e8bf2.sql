-- Add real visibility column to stories
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Backfill from the music_title `v:<vis>` hack
UPDATE public.stories
SET visibility = SUBSTRING(music_title FROM 3),
    music_title = NULL
WHERE music_title LIKE 'v:%';

-- Constrain allowed values via trigger (avoid CHECK rigidity)
CREATE OR REPLACE FUNCTION public.validate_story_visibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility NOT IN ('public', 'followers', 'only_me') THEN
    RAISE EXCEPTION 'Invalid visibility: %', NEW.visibility;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_story_visibility_trigger ON public.stories;
CREATE TRIGGER validate_story_visibility_trigger
  BEFORE INSERT OR UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.validate_story_visibility();

-- Replace permissive SELECT policy with privacy-aware one
DROP POLICY IF EXISTS "Stories viewable by everyone" ON public.stories;

CREATE POLICY "Stories visible by privacy"
ON public.stories
FOR SELECT
USING (
  visibility = 'public'
  OR auth.uid() = user_id
  OR (visibility = 'followers' AND public.is_following(auth.uid(), user_id))
);