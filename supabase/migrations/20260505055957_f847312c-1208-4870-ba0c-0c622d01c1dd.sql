
-- Allow message senders to delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Video trim window for posts/reels (optional)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS clip_start integer,
  ADD COLUMN IF NOT EXISTS clip_end integer;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS clip_start integer,
  ADD COLUMN IF NOT EXISTS clip_end integer;
