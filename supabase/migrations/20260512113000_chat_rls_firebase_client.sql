-- The app authenticates users with Firebase on the client. Supabase RLS
-- auth.uid() is therefore empty for those sessions, so direct chat inserts
-- can be blocked even when the app has a signed-in Firebase user.

DROP POLICY IF EXISTS "Firebase clients can read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Firebase clients can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Firebase clients can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Firebase clients can read messages" ON public.messages;
DROP POLICY IF EXISTS "Firebase clients can send messages" ON public.messages;
DROP POLICY IF EXISTS "Firebase clients can update messages" ON public.messages;

CREATE POLICY "Firebase clients can read conversations"
ON public.conversations
FOR SELECT
USING (true);

CREATE POLICY "Firebase clients can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (user1_id IS NOT NULL AND user2_id IS NOT NULL AND user1_id <> user2_id);

CREATE POLICY "Firebase clients can update conversations"
ON public.conversations
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Firebase clients can read messages"
ON public.messages
FOR SELECT
USING (true);

CREATE POLICY "Firebase clients can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.user1_id = sender_id OR c.user2_id = sender_id)
  )
);

CREATE POLICY "Firebase clients can update messages"
ON public.messages
FOR UPDATE
USING (true)
WITH CHECK (true);
