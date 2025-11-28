-- Migration: 015_add_rls_policies.sql
-- Description: Adds RLS policies for the sales and metric_events tables.
-- =====================================================

-- 1. Enable RLS on the sales table
-- =====================================================
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 2. Add RLS policies for the sales table
-- =====================================================
CREATE POLICY "Shop members can view their own facility sales"
ON sales FOR SELECT
USING (
  is_shop_member(auth.uid(), facility_id)
);

CREATE POLICY "Shop members can insert sales for their own facility"
ON sales FOR INSERT
WITH CHECK (
  is_shop_member(auth.uid(), facility_id)
);

-- 3. Refine RLS policies for the metric_events table
-- =====================================================
DROP POLICY "Admins can view all metric events" ON metric_events;
CREATE POLICY "Admins and Super Admins can view all metric events"
ON metric_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
);
