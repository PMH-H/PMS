-- 075_platform_settings.sql
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    label TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.platform_settings (key, value, label, description)
VALUES 
    ('enable_premium_sms', 'true'::jsonb, 'Premium SMS Reminders', 'Enable or disable the option for patients to subscribe to SMS reminders.'),
    ('enable_telehealth', 'true'::jsonb, 'Telehealth Services', 'Enable or disable all telehealth consultation booking features globally.')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed for frontend UI to hide/show features)
CREATE POLICY "Public read settings" ON public.platform_settings
    FOR SELECT USING (true);

-- Only Super Admins can update
CREATE POLICY "Super Admins update settings" ON public.platform_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin_bms', 'super_admin_dev')
        )
    );
