-- 095_map_integration.sql
-- Adds geospatial columns to facilities for Map View
-- Ensures order linkage for tracking

-- 1. Add Latitude/Longitude to Facilities
ALTER TABLE public.facilities 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);

-- 2. Seed some default locations for Lusaka (Demo Data)
UPDATE public.facilities 
SET latitude = -15.416667, longitude = 28.283333 
WHERE name ILIKE '%Headquarters%' OR type = 'NATIONAL_OFFICE';

UPDATE public.facilities 
SET latitude = -15.3875, longitude = 28.3228 
WHERE latitude IS NULL; -- Set others to generic Lusaka center

-- 3. Ensure Customer Orders can link to Facilities
DO $$ 
BEGIN
    -- Check if customer_orders is a table (not a view) and missing facility_id
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_orders') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'customer_orders' AND column_name = 'facility_id') THEN
            ALTER TABLE public.customer_orders 
            ADD COLUMN facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;
            
            -- Try to backfill facility_id from prescriptions if possible?
            -- Complex update, leave for manual or application logic
        END IF;
    END IF;
END $$;

-- 4. Add Indexes for Map Queries
CREATE INDEX IF NOT EXISTS idx_facilities_coords ON public.facilities(latitude, longitude);
