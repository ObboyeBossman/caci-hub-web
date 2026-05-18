-- Insert the member-photos storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS on 'storage.objects' for 'member-photos'

-- 1. Public Read access
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'member-photos');

-- 2. Authenticated users can INSERT
CREATE POLICY "Auth Insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'member-photos' AND auth.role() = 'authenticated');

-- 3. Authenticated users can UPDATE
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'member-photos' AND auth.role() = 'authenticated');

-- 4. Authenticated users can DELETE
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'member-photos' AND auth.role() = 'authenticated');
