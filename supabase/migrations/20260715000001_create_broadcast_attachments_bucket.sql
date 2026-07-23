-- Create the storage bucket for broadcast attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('broadcast_attachments', 'broadcast_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for the bucket
-- Allow anyone to read the attachments (since it's a public bucket, objects can be fetched)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'broadcast_attachments' );

-- Allow authenticated admins to upload files
CREATE POLICY "Admins can upload attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'broadcast_attachments' 
    AND public.is_admin()
);

-- Allow authenticated admins to delete files
CREATE POLICY "Admins can delete attachments" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'broadcast_attachments' 
    AND public.is_admin()
);
