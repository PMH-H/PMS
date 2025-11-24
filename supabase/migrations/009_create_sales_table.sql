-- =====================================================
-- CREATE SALES TABLE
-- =====================================================
-- This table was missing from the initial schema
-- It stores all sales transactions with items as JSONB

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_price NUMERIC(12,2) NOT NULL,
    customer_info TEXT,
    sold_by_user_id UUID REFERENCES public.profiles(id),
    payment_method TEXT DEFAULT 'CASH',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_facility ON public.sales(facility_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(sold_by_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_sales_updated_at 
    BEFORE UPDATE ON public.sales
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Allow users to insert sales at their facility
CREATE POLICY "Users can insert sales at their facility"
    ON public.sales
    FOR INSERT
    TO authenticated
    WITH CHECK (
        facility_id IN (
            SELECT facility_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Allow users to view sales at their facility
CREATE POLICY "Users can view sales at their facility"
    ON public.sales
    FOR SELECT
    TO authenticated
    USING (
        facility_id IN (
            SELECT facility_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.sales IS 'Sales transactions with items stored as JSONB array';
