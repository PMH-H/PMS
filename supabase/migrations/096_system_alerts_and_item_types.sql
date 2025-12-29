-- Create system_alerts table for Global Announcements and Maintenance Mode
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'critical', 'maintenance')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
DROP POLICY IF EXISTS "Everyone can view active alerts" ON public.system_alerts;
CREATE POLICY "Everyone can view active alerts" ON public.system_alerts
    FOR SELECT USING (is_active = true);

-- Allow admins to manage alerts
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.system_alerts;
CREATE POLICY "Admins can manage alerts" ON public.system_alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- Update items table to support non-drug products
-- Use DO block to avoid errors if columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'type') THEN
        ALTER TABLE public.items ADD COLUMN type TEXT DEFAULT 'DRUG';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'is_prescribable') THEN
        ALTER TABLE public.items ADD COLUMN is_prescribable BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add check constraint for item types (extensible)
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_type_check;
ALTER TABLE public.items ADD CONSTRAINT items_type_check 
    CHECK (type IN ('DRUG', 'EQUIPMENT', 'SUPPLY', 'SERVICE'));

-- Update existing items to be Drugs where null
UPDATE public.items SET type = 'DRUG', is_prescribable = true WHERE type IS NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
