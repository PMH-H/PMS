-- Add owner_id to facilities table
ALTER TABLE public.facilities 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_facilities_owner ON public.facilities(owner_id);

-- Update RLS policies to enforce ownership
-- 1. Owners can update their facility
CREATE POLICY "Owners can update their facility"
    ON public.facilities
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- 2. Owners can delete their facility
CREATE POLICY "Owners can delete their facility"
    ON public.facilities
    FOR DELETE
    USING (auth.uid() = owner_id);

-- 3. Ensure admins are still linked (existing policy covers SELECT)

-- Backfill: If a user is an admin and has this facility_id, make them owner (Approximation for existing data)
-- This is a best-effort backfill for single-admin facilities.
DO $$
BEGIN
    UPDATE public.facilities f
    SET owner_id = (
        SELECT id FROM public.profiles p 
        WHERE p.facility_id = f.id 
        AND p.role::text IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        LIMIT 1
    )
    WHERE owner_id IS NULL;
END $$;
