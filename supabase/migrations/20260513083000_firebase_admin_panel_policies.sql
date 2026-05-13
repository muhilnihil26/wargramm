DROP POLICY IF EXISTS "Client admin settings insert" ON public.admin_settings;
CREATE POLICY "Client admin settings insert"
  ON public.admin_settings FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin settings update" ON public.admin_settings;
CREATE POLICY "Client admin settings update"
  ON public.admin_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin settings delete" ON public.admin_settings;
CREATE POLICY "Client admin settings delete"
  ON public.admin_settings FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "Client admin music insert" ON public.music;
CREATE POLICY "Client admin music insert"
  ON public.music FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin music delete" ON public.music;
CREATE POLICY "Client admin music delete"
  ON public.music FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "Client admin coupons insert" ON public.coupons;
CREATE POLICY "Client admin coupons insert"
  ON public.coupons FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin coupons delete" ON public.coupons;
CREATE POLICY "Client admin coupons delete"
  ON public.coupons FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "Client admin verification update" ON public.verification_requests;
CREATE POLICY "Client admin verification update"
  ON public.verification_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin profile update" ON public.profiles;
CREATE POLICY "Client admin profile update"
  ON public.profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin post moderate" ON public.posts;
CREATE POLICY "Client admin post moderate"
  ON public.posts FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Client admin reel moderate" ON public.reels;
CREATE POLICY "Client admin reel moderate"
  ON public.reels FOR UPDATE
  USING (true)
  WITH CHECK (true);
