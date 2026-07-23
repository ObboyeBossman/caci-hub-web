CREATE TABLE public.assembly_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembly_name TEXT NOT NULL DEFAULT 'Adabraka Central Assembly',
    assembly_location TEXT NOT NULL DEFAULT 'Adabraka District',
    default_password TEXT NOT NULL DEFAULT 'CACI#Adabraka2026',
    force_password_reset BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.assembly_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Allow read access for authenticated users on assembly_settings"
    ON public.assembly_settings FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can update settings
CREATE POLICY "Allow update for admins on assembly_settings"
    ON public.assembly_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

CREATE POLICY "Allow insert for admins on assembly_settings"
    ON public.assembly_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

-- Insert default row
INSERT INTO public.assembly_settings (assembly_name, assembly_location, default_password, force_password_reset)
VALUES ('Assakae Central Assembly', 'Assakae District', 'CACI@2026!', true);
