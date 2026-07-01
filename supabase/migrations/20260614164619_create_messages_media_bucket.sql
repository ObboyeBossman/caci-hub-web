-- Insert the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('messages-media-private', 'messages-media-private', false, null, null)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for the bucket objects
CREATE POLICY "messages_media_private_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'messages-media-private');

CREATE POLICY "messages_media_private_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'messages-media-private');

CREATE POLICY "messages_media_private_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'messages-media-private');

CREATE POLICY "messages_media_private_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'messages-media-private');
