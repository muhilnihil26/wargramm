-- Tighten the verifications bucket: only the owner of the file or an admin
-- may list files. Direct URLs continue to work because the bucket is public.
DROP POLICY IF EXISTS "Verification files publicly readable" ON storage.objects;

CREATE POLICY "Verification files visible to owner or admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verifications'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );