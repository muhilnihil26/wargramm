CREATE TABLE IF NOT EXISTS public.youtube_library_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  url text NOT NULL,
  title text NOT NULL DEFAULT 'Saved video',
  thumbnail_url text,
  trim_start integer NOT NULL DEFAULT 0,
  trim_end integer NOT NULL DEFAULT 60,
  is_playlist boolean NOT NULL DEFAULT false,
  playlist_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_library_client_uid_created
  ON public.youtube_library_client(firebase_uid, created_at DESC);

ALTER TABLE public.youtube_library_client ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client youtube library read" ON public.youtube_library_client;
CREATE POLICY "Client youtube library read"
  ON public.youtube_library_client FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Client youtube library insert" ON public.youtube_library_client;
CREATE POLICY "Client youtube library insert"
  ON public.youtube_library_client FOR INSERT
  WITH CHECK (firebase_uid IS NOT NULL AND length(firebase_uid) > 0);

DROP POLICY IF EXISTS "Client youtube library update" ON public.youtube_library_client;
CREATE POLICY "Client youtube library update"
  ON public.youtube_library_client FOR UPDATE
  USING (true)
  WITH CHECK (firebase_uid IS NOT NULL AND length(firebase_uid) > 0);

DROP POLICY IF EXISTS "Client youtube library delete" ON public.youtube_library_client;
CREATE POLICY "Client youtube library delete"
  ON public.youtube_library_client FOR DELETE
  USING (true);
