-- =============================================================================
-- CACI Hub — Migration 20260509000003
-- Purpose:  Replace overly permissive member-photos storage policies with
--           ownership-scoped versions. Previously any authenticated user could
--           overwrite any other user's photo. Photos are now stored under a
--           per-user prefix: member-photos/<auth.uid()>/<filename>.
-- =============================================================================

-- Drop the old permissive policies
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Public read — anyone can view member photos (URLs are used in the directory).
CREATE POLICY "member_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-photos');

-- Insert — authenticated users may only upload under their own UID prefix.
CREATE POLICY "member_photos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'member-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update — authenticated users may only update their own files.
CREATE POLICY "member_photos_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'member-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete — authenticated users may only delete their own files.
CREATE POLICY "member_photos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'member-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );