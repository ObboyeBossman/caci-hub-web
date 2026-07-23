CREATE TABLE public.sermons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    speaker TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    scripture_reference TEXT,
    audio_url TEXT,
    video_url TEXT,
    cover_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.sermons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all authenticated users on sermons"
    ON public.sermons FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow all access for admins on sermons"
    ON public.sermons FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

INSERT INTO storage.buckets (id, name, public) VALUES ('sermon_media', 'sermon_media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sermon_media_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'sermon_media');

CREATE POLICY "sermon_media_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'sermon_media' AND
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin'
    )
);

CREATE POLICY "sermon_media_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'sermon_media' AND
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin'
    )
);

CREATE POLICY "sermon_media_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'sermon_media' AND
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin'
    )
);
