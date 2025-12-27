-- Migration 087: Reports RPCs and Security Access
-- Objective: Provide aggregated data for reports and ensure Super Admin access to audits.

-- PREREQUISITE: Create helper functions used by this migration
-- check_user_role: Checks if a user has a specific role
CREATE OR REPLACE FUNCTION public.check_user_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = p_user_id 
        AND role::text = p_role
    );
END;
$$;

-- check_is_super_admin: Checks if user is a super admin (dev or bms)
CREATE OR REPLACE FUNCTION public.check_is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = p_user_id 
        AND role::text IN ('super_admin_dev', 'super_admin_bms')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_super_admin(UUID) TO authenticated;

-- 1. Inventory Valuation Report
-- Returns total cost value and total retail value of current stock.
CREATE OR REPLACE FUNCTION inventory.get_inventory_valuation(p_facility_id UUID)
RETURNS TABLE (
    total_cost_value NUMERIC,
    total_retail_value NUMERIC,
    item_count BIGINT,
    batch_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = inventory, commerce, public
AS $$
BEGIN
    -- Check permissions (Admin, Pharmacist, Super Admins)
    IF NOT public.check_user_role(auth.uid(), 'admin') AND
       NOT public.check_user_role(auth.uid(), 'pharmacist') AND
       NOT public.check_is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(SUM(ib.unit_cost * ib.quantity), 0) as total_cost_value,
        COALESCE(SUM(i.unit_price * ib.quantity), 0) as total_retail_value,
        COUNT(DISTINCT i.id) as item_count,
        COUNT(ib.id) as batch_count
    FROM inventory.item_batches ib
    JOIN inventory.items i ON ib.item_id = i.id
    WHERE ib.quantity > 0
    AND (
        (public.check_is_super_admin(auth.uid()) AND (p_facility_id IS NULL OR i.facility_id = p_facility_id)) -- Super Admin can view all or specific
        OR
        (i.facility_id = p_facility_id) -- Local users restricted to their facility
    );
END;
$$;

-- 2. Expiry Risk Report
-- Returns batches expiring within a specified number of days (default 90).
CREATE OR REPLACE FUNCTION inventory.get_expiry_risk_report(p_facility_id UUID, p_days INT DEFAULT 90)
RETURNS TABLE (
    batch_number TEXT,
    drug_name TEXT,
    expiry_date DATE,
    quantity INT,
    days_until_expiry INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = inventory, public
AS $$
BEGIN
    IF NOT public.check_user_role(auth.uid(), 'admin') AND
       NOT public.check_user_role(auth.uid(), 'pharmacist') AND
       NOT public.check_is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        ib.batch_number,
        i.name as drug_name,
        ib.expiry_date,
        ib.quantity,
        (ib.expiry_date - CURRENT_DATE)::INT as days_until_expiry
    FROM inventory.item_batches ib
    JOIN inventory.items i ON ib.item_id = i.id
    WHERE ib.quantity > 0
    AND ib.expiry_date <= (CURRENT_DATE + p_days)
    AND (
        (public.check_is_super_admin(auth.uid()) AND (p_facility_id IS NULL OR i.facility_id = p_facility_id))
        OR
        (i.facility_id = p_facility_id)
    )
    ORDER BY ib.expiry_date ASC;
END;
$$;

-- 3. Period Sales Report
-- Returns daily sales aggregates for a given period.
CREATE OR REPLACE FUNCTION commerce.get_period_sales_report(p_facility_id UUID, p_start_date TIMESTAMP, p_end_date TIMESTAMP)
RETURNS TABLE (
    sale_date DATE,
    total_revenue NUMERIC,
    transaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = commerce, public
AS $$
BEGIN
    IF NOT public.check_user_role(auth.uid(), 'admin') AND
       NOT public.check_user_role(auth.uid(), 'pharmacist') AND
       NOT public.check_is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        DATE(created_at) as sale_date,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(*) as transaction_count
    FROM commerce.sales
    WHERE facility_id = p_facility_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) DESC;
END;
$$;

-- 4. Super Admin Audit Access (Security Requirement)
-- Ensure 'super_admin_dev' can read ALL rows in audit.audit_logs
DROP POLICY IF EXISTS "Super Admin Dev Audit Access" ON audit.audit_logs;

CREATE POLICY "Super Admin Dev Audit Access"
ON audit.audit_logs
FOR SELECT
TO authenticated
USING (
    public.check_user_role(auth.uid(), 'super_admin_dev')
    OR
    public.check_user_role(auth.uid(), 'super_admin_bms')
    -- OR existing logic for facility admins (handled by other policies usually, but ensuring explicit super access here)
);

-- Grant Execute Permissions
GRANT EXECUTE ON FUNCTION inventory.get_inventory_valuation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION inventory.get_expiry_risk_report(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION commerce.get_period_sales_report(UUID, TIMESTAMP, TIMESTAMP) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION inventory.get_inventory_valuation IS 'Calculates financial value of current stock for reports.';
COMMENT ON FUNCTION inventory.get_expiry_risk_report IS 'Lists stock expiring soon for risk management.';
COMMENT ON FUNCTION commerce.get_period_sales_report IS 'Aggregates sales revenue by day for a given date range.';
