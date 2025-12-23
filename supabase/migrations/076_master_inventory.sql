-- 076_master_inventory.sql

-- 1. Add Multitenancy columns to 'items'
-- We assume existing items are 'Global'/Master items for now.
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id);

-- 2. Update RLS on 'items'
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Items are viewable by everyone" ON public.items;
DROP POLICY IF EXISTS "Items are viewable by authenticated users" ON public.items;

-- READ: Everyone can see Global items. 
-- Specific facilities can see their own private items.
CREATE POLICY "View Global or Local Items" ON public.items
    FOR SELECT
    USING (
        is_global = TRUE 
        OR 
        (facility_id IS NOT NULL AND facility_id IN (
            SELECT facility_id FROM public.profiles WHERE id = auth.uid()
        ))
    );

-- INSERT: 
-- Super Admins can create Global Items.
-- Pharmacists/Admins can create Local Items (is_global=false, facility_id=their_facility).
CREATE POLICY "Insert Items" ON public.items
    FOR INSERT
    WITH CHECK (
        -- Case 1: Super Admin creating Global Item
        (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role IN ('super_admin_bms', 'super_admin_dev')
            )
        )
        OR
        -- Case 2: Facility Admin/Pharmacist creating Local Item
        (
            facility_id IS NOT NULL 
            AND is_global = FALSE
            AND facility_id IN (
                SELECT facility_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- UPDATE:
-- Super Admins -> Global Items
-- Facility Staff -> Their Local Items
CREATE POLICY "Update Items" ON public.items
    FOR UPDATE
    USING (
        (is_global = TRUE AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin_bms', 'super_admin_dev')))
        OR
        (is_global = FALSE AND facility_id IN (SELECT facility_id FROM public.profiles WHERE id = auth.uid()))
    );

-- 3. Optimization: Index on facility_id
CREATE INDEX IF NOT EXISTS idx_items_facility_id ON public.items(facility_id);
