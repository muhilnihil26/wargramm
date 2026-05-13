CREATE TABLE IF NOT EXISTS public.firebase_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL UNIQUE,
  email text,
  username text,
  full_name text,
  avatar_url text,
  bio text DEFAULT '',
  website text DEFAULT '',
  instagram_username text,
  phone text,
  is_private boolean NOT NULL DEFAULT false,
  show_activity boolean NOT NULL DEFAULT true,
  notification_ringtone text,
  account_type text NOT NULL DEFAULT 'personal',
  is_verified boolean NOT NULL DEFAULT false,
  verification_status text,
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS firebase_profiles_search_idx
  ON public.firebase_profiles (lower(username), lower(full_name), lower(email));

ALTER TABLE public.firebase_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client profiles read" ON public.firebase_profiles;
CREATE POLICY "Client profiles read"
  ON public.firebase_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Client profiles insert" ON public.firebase_profiles;
CREATE POLICY "Client profiles insert"
  ON public.firebase_profiles FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL);

DROP POLICY IF EXISTS "Client profiles update" ON public.firebase_profiles;
CREATE POLICY "Client profiles update"
  ON public.firebase_profiles FOR UPDATE
  USING (firebase_uid IS NOT NULL)
  WITH CHECK (firebase_uid IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.saved_posts_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(firebase_uid, post_id)
);

CREATE INDEX IF NOT EXISTS saved_posts_client_uid_idx
  ON public.saved_posts_client(firebase_uid, created_at DESC);

ALTER TABLE public.saved_posts_client ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client saved posts read" ON public.saved_posts_client;
CREATE POLICY "Client saved posts read"
  ON public.saved_posts_client FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Client saved posts write" ON public.saved_posts_client;
CREATE POLICY "Client saved posts write"
  ON public.saved_posts_client FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL);

DROP POLICY IF EXISTS "Client saved posts delete" ON public.saved_posts_client;
CREATE POLICY "Client saved posts delete"
  ON public.saved_posts_client FOR DELETE
  USING (firebase_uid IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.firebase_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sender_id text NOT NULL,
  participant_ids text[] NOT NULL DEFAULT '{}',
  content text NOT NULL DEFAULT '',
  image_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS firebase_messages_room_created_idx
  ON public.firebase_messages(room_id, created_at);

ALTER TABLE public.firebase_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client messages read" ON public.firebase_messages;
CREATE POLICY "Client messages read"
  ON public.firebase_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Client messages insert" ON public.firebase_messages;
CREATE POLICY "Client messages insert"
  ON public.firebase_messages FOR INSERT
  WITH CHECK (room_id IS NOT NULL AND sender_id IS NOT NULL);
