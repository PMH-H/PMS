-- =====================================================
-- PHARMAI - ROW LEVEL SECURITY POLICIES
-- =====================================================
-- Implements role-based access control with facility isolation
-- =====================================================

-- =====================================================
-- FIX: Make policies idempotent
-- =====================================================
-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view facility profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can manage profiles" ON profiles;

-- Facilities policies
DROP POLICY IF EXISTS "Anyone can view active facilities" ON facilities;
DROP POLICY IF EXISTS "Admins can manage own facility" ON facilities;
DROP POLICY IF EXISTS "Super admins can manage all facilities" ON facilities;

-- Items policies
DROP POLICY IF EXISTS "Anyone can view items" ON items;
DROP POLICY IF EXISTS "Staff can create items" ON items;
DROP POLICY IF EXISTS "Admins can update items" ON items;
DROP POLICY IF EXISTS "Super admins can delete items" ON items;

-- Item batches policies
DROP POLICY IF EXISTS "Customers can view available batches" ON item_batches;
DROP POLICY IF EXISTS "Staff can view facility batches" ON item_batches;
DROP POLICY IF EXISTS "Staff can add batches" ON item_batches;
DROP POLICY IF EXISTS "Staff can update batches" ON item_batches;
DROP POLICY IF EXISTS "Admins can delete batches" ON item_batches;

-- Stock movements policies
DROP POLICY IF EXISTS "Staff can view facility movements" ON stock_movements;
DROP POLICY IF EXISTS "Staff can record movements" ON stock_movements;
DROP POLICY IF EXISTS "Super admins can delete movements" ON stock_movements;

-- Suppliers policies
DROP POLICY IF EXISTS "Staff can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;

-- Purchase orders policies
DROP POLICY IF EXISTS "Staff can view facility POs" ON purchase_orders;
DROP POLICY IF EXISTS "Staff can create POs" ON purchase_orders;
DROP POLICY IF EXISTS "Staff can update draft POs" ON purchase_orders;
DROP POLICY IF EXISTS "Admins can update PO status" ON purchase_orders;
DROP POLICY IF EXISTS "Admins can delete draft POs" ON purchase_orders;

-- Purchase order items policies
DROP POLICY IF EXISTS "Staff can view PO items" ON purchase_order_items;
DROP POLICY IF EXISTS "Staff can add PO items" ON purchase_order_items;
DROP POLICY IF EXISTS "Staff can update PO items" ON purchase_order_items;
DROP POLICY IF EXISTS "Staff can delete PO items" ON purchase_order_items;

-- Cycle counts policies
DROP POLICY IF EXISTS "Staff can view facility cycle counts" ON cycle_counts;
DROP POLICY IF EXISTS "Admins can create cycle counts" ON cycle_counts;
DROP POLICY IF EXISTS "Assigned staff can update cycle counts" ON cycle_counts;
DROP POLICY IF EXISTS "Admins can delete cycle counts" ON cycle_counts;

-- Cycle count results policies
DROP POLICY IF EXISTS "Staff can view cycle count results" ON cycle_count_results;
DROP POLICY IF EXISTS "Assigned staff can add results" ON cycle_count_results;
DROP POLICY IF EXISTS "Assigned staff can update results" ON cycle_count_results;

-- Analytics policies
DROP POLICY IF EXISTS "Staff can view facility analytics" ON inventory_analytics;
DROP POLICY IF EXISTS "System can insert analytics" ON inventory_analytics;

-- Alerts policies
DROP POLICY IF EXISTS "Staff can view facility alerts" ON alerts;
DROP POLICY IF EXISTS "System can create alerts" ON alerts;
DROP POLICY IF EXISTS "Staff can update alerts" ON alerts;

-- Vendor performance policies
DROP POLICY IF EXISTS "Staff can view vendor performance" ON vendor_performance;
DROP POLICY IF EXISTS "System can insert vendor performance" ON vendor_performance;

-- Audit log policies
DROP POLICY IF EXISTS "Admins can view facility audit logs" ON audit_log;
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_log;

-- User feedback policies
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;

-- Search logs policies
DROP POLICY IF EXISTS "Anyone can log searches" ON search_logs;
DROP POLICY IF EXISTS "Super admins can view search logs" ON search_logs;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's facility
CREATE OR REPLACE FUNCTION get_user_facility()
RETURNS UUID AS $$
  SELECT facility_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user has access to a facility (including hierarchy)
CREATE OR REPLACE FUNCTION has_facility_access(target_facility_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_facility UUID;
  user_role_val user_role;
BEGIN
  SELECT facility_id, role INTO user_facility, user_role_val 
  FROM profiles WHERE id = auth.uid();
  
  -- Super admins have access to all facilities
  IF user_role_val IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV') THEN
    RETURN TRUE;
  END IF;
  
  -- Check if target facility is user's facility or a descendant
  RETURN EXISTS (
    WITH RECURSIVE facility_tree AS (
      SELECT id, parent_id FROM facilities WHERE id = user_facility
      UNION ALL
      SELECT f.id, f.parent_id 
      FROM facilities f
      INNER JOIN facility_tree ft ON f.parent_id = ft.id
    )
    SELECT 1 FROM facility_tree WHERE id = target_facility_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin or above
CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is staff (not customer)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT role != 'CUSTOMER' FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

DO $$ DECLARE
  tbl_name TEXT;
BEGIN
  FOR tbl_name IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN (
      'profiles', 'facilities', 'items', 'item_batches', 'stock_movements', 
      'suppliers', 'purchase_orders', 'purchase_order_items', 'cycle_counts', 
      'cycle_count_results', 'inventory_analytics', 'alerts', 'vendor_performance', 
      'audit_log', 'feedback', 'search_logs'
    )
  LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(tbl_name) || ' ENABLE ROW LEVEL SECURITY;';
  END LOOP;
END $$;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles in their facility
CREATE POLICY "Admins can view facility profiles"
  ON profiles FOR SELECT
  USING (
    is_admin_or_above() AND 
    (facility_id = get_user_facility() OR get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'))
  );

-- Super admins can manage all profiles
CREATE POLICY "Super admins can manage profiles"
  ON profiles FOR ALL
  USING (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'))
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'));

-- =====================================================
-- FACILITIES POLICIES
-- =====================================================

-- Everyone can view active facilities (for dropdown lists)
CREATE POLICY "Anyone can view active facilities"
  ON facilities FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage their own facility
CREATE POLICY "Admins can manage own facility"
  ON facilities FOR ALL
  USING (is_admin_or_above() AND id = get_user_facility())
  WITH CHECK (is_admin_or_above() AND id = get_user_facility());

-- Super admins can manage all facilities
CREATE POLICY "Super admins can manage all facilities"
  ON facilities FOR ALL
  USING (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'))
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'));

-- =====================================================
-- ITEMS POLICIES (Master Catalog)
-- =====================================================

-- Everyone can view items (public catalog)
CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (TRUE);

-- Staff can create items
CREATE POLICY "Staff can create items"
  ON items FOR INSERT
  WITH CHECK (is_staff());

-- Admins can update items
CREATE POLICY "Admins can update items"
  ON items FOR UPDATE
  USING (is_admin_or_above())
  WITH CHECK (is_admin_or_above());

-- Super admins can delete items
CREATE POLICY "Super admins can delete items"
  ON items FOR DELETE
  USING (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'));

-- =====================================================
-- ITEM_BATCHES POLICIES
-- =====================================================

-- Customers can view available stock in any facility
CREATE POLICY "Customers can view available batches"
  ON item_batches FOR SELECT
  USING (get_user_role() = 'CUSTOMER' AND current_quantity > 0);

-- Staff can view batches in their facility
CREATE POLICY "Staff can view facility batches"
  ON item_batches FOR SELECT
  USING (is_staff() AND has_facility_access(facility_id));

-- Staff can add batches to their facility
CREATE POLICY "Staff can add batches"
  ON item_batches FOR INSERT
  WITH CHECK (is_staff() AND facility_id = get_user_facility());

-- Staff can update batches in their facility
CREATE POLICY "Staff can update batches"
  ON item_batches FOR UPDATE
  USING (is_staff() AND facility_id = get_user_facility())
  WITH CHECK (is_staff() AND facility_id = get_user_facility());

-- Admins can delete batches
CREATE POLICY "Admins can delete batches"
  ON item_batches FOR DELETE
  USING (is_admin_or_above() AND facility_id = get_user_facility());

-- =====================================================
-- STOCK_MOVEMENTS POLICIES
-- =====================================================

-- Staff can view movements in their facility
CREATE POLICY "Staff can view facility movements"
  ON stock_movements FOR SELECT
  USING (is_staff() AND has_facility_access(facility_id));

-- Staff can record movements in their facility
CREATE POLICY "Staff can record movements"
  ON stock_movements FOR INSERT
  WITH CHECK (is_staff() AND facility_id = get_user_facility());

-- No updates or deletes (audit trail integrity)
-- Only super admins can delete (for corrections)
CREATE POLICY "Super admins can delete movements"
  ON stock_movements FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN_DEV');

-- =====================================================
-- SUPPLIERS POLICIES
-- =====================================================

-- Staff can view suppliers
CREATE POLICY "Staff can view suppliers"
  ON suppliers FOR SELECT
  USING (is_staff());

-- Admins can manage suppliers
CREATE POLICY "Admins can manage suppliers"
  ON suppliers FOR ALL
  USING (is_admin_or_above())
  WITH CHECK (is_admin_or_above());

-- =====================================================
-- PURCHASE_ORDERS POLICIES
-- =====================================================

-- Staff can view POs for their facility
CREATE POLICY "Staff can view facility POs"
  ON purchase_orders FOR SELECT
  USING (is_staff() AND has_facility_access(facility_id));

-- Staff can create POs for their facility
CREATE POLICY "Staff can create POs"
  ON purchase_orders FOR INSERT
  WITH CHECK (is_staff() AND facility_id = get_user_facility());

-- Staff can update draft POs
CREATE POLICY "Staff can update draft POs"
  ON purchase_orders FOR UPDATE
  USING (is_staff() AND facility_id = get_user_facility() AND status = 'DRAFT')
  WITH CHECK (is_staff() AND facility_id = get_user_facility());

-- Admins can update any PO status
CREATE POLICY "Admins can update PO status"
  ON purchase_orders FOR UPDATE
  USING (is_admin_or_above() AND facility_id = get_user_facility())
  WITH CHECK (is_admin_or_above() AND facility_id = get_user_facility());

-- Admins can delete draft POs
CREATE POLICY "Admins can delete draft POs"
  ON purchase_orders FOR DELETE
  USING (is_admin_or_above() AND facility_id = get_user_facility() AND status = 'DRAFT');

-- =====================================================
-- PURCHASE_ORDER_ITEMS POLICIES
-- =====================================================

-- Staff can view PO items if they can view the PO
CREATE POLICY "Staff can view PO items"
  ON purchase_order_items FOR SELECT
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE id = po_id AND has_facility_access(facility_id)
    )
  );

-- Staff can add items to draft POs
CREATE POLICY "Staff can add PO items"
  ON purchase_order_items FOR INSERT
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE id = po_id AND facility_id = get_user_facility() AND status = 'DRAFT'
    )
  );

-- Staff can update items in draft POs
CREATE POLICY "Staff can update PO items"
  ON purchase_order_items FOR UPDATE
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE id = po_id AND facility_id = get_user_facility() AND status = 'DRAFT'
    )
  )
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE id = po_id AND facility_id = get_user_facility() AND status = 'DRAFT'
    )
  );

-- Staff can delete items from draft POs
CREATE POLICY "Staff can delete PO items"
  ON purchase_order_items FOR DELETE
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE id = po_id AND facility_id = get_user_facility() AND status = 'DRAFT'
    )
  );

-- =====================================================
-- CYCLE_COUNTS POLICIES
-- =====================================================

-- Staff can view cycle counts for their facility
CREATE POLICY "Staff can view facility cycle counts"
  ON cycle_counts FOR SELECT
  USING (is_staff() AND has_facility_access(facility_id));

-- Admins can create cycle counts
CREATE POLICY "Admins can create cycle counts"
  ON cycle_counts FOR INSERT
  WITH CHECK (is_admin_or_above() AND facility_id = get_user_facility());

-- Assigned staff can update their cycle counts
CREATE POLICY "Assigned staff can update cycle counts"
  ON cycle_counts FOR UPDATE
  USING (
    is_staff() AND 
    facility_id = get_user_facility() AND 
    (assigned_to = auth.uid() OR is_admin_or_above())
  )
  WITH CHECK (
    is_staff() AND 
    facility_id = get_user_facility() AND 
    (assigned_to = auth.uid() OR is_admin_or_above())
  );

-- Admins can delete cycle counts
CREATE POLICY "Admins can delete cycle counts"
  ON cycle_counts FOR DELETE
  USING (is_admin_or_above() AND facility_id = get_user_facility());

-- =====================================================
-- CYCLE_COUNT_RESULTS POLICIES
-- =====================================================

-- Staff can view results if they can view the cycle count
CREATE POLICY "Staff can view cycle count results"
  ON cycle_count_results FOR SELECT
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM cycle_counts 
      WHERE id = cycle_count_id AND has_facility_access(facility_id)
    )
  );

-- Assigned staff can add results
CREATE POLICY "Assigned staff can add results"
  ON cycle_count_results FOR INSERT
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM cycle_counts 
      WHERE id = cycle_count_id 
      AND facility_id = get_user_facility()
      AND (assigned_to = auth.uid() OR is_admin_or_above())
    )
  );

-- Assigned staff can update results (before approval)
CREATE POLICY "Assigned staff can update results"
  ON cycle_count_results FOR UPDATE
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM cycle_counts 
      WHERE id = cycle_count_id 
      AND facility_id = get_user_facility()
      AND status != 'APPROVED'
      AND (assigned_to = auth.uid() OR is_admin_or_above())
    )
  )
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM cycle_counts 
      WHERE id = cycle_count_id 
      AND facility_id = get_user_facility()
      AND status != 'APPROVED'
      AND (assigned_to = auth.uid() OR is_admin_or_above())
    )
  );

-- =====================================================
-- INVENTORY_ANALYTICS POLICIES
-- =====================================================

-- Staff can view analytics for their facility
CREATE POLICY "Staff can view facility analytics"
  ON inventory_analytics FOR SELECT
  USING (is_staff() AND has_facility_access(facility_id));

-- System can insert analytics (via Edge Functions)
CREATE POLICY "System can insert analytics"
  ON inventory_analytics FOR INSERT
  WITH CHECK (TRUE); -- Edge Functions run with service role

-- =====================================================
-- ALERTS POLICIES
-- =====================================================

-- Staff can view alerts for their facility
CREATE POLICY "Staff can view facility alerts"
  ON alerts FOR SELECT
  USING (is_staff() AND has_facility_access(facility_id));

-- System can create alerts
CREATE POLICY "System can create alerts"
  ON alerts FOR INSERT
  WITH CHECK (TRUE); -- Edge Functions run with service role

-- Staff can mark alerts as read/resolved
CREATE POLICY "Staff can update alerts"
  ON alerts FOR UPDATE
  USING (is_staff() AND has_facility_access(facility_id))
  WITH CHECK (is_staff() AND has_facility_access(facility_id));

-- =====================================================
-- VENDOR_PERFORMANCE POLICIES
-- =====================================================

-- Staff can view vendor performance
CREATE POLICY "Staff can view vendor performance"
  ON vendor_performance FOR SELECT
  USING (is_staff());

-- System can insert performance data
CREATE POLICY "System can insert vendor performance"
  ON vendor_performance FOR INSERT
  WITH CHECK (TRUE); -- Edge Functions run with service role

-- =====================================================
-- AUDIT_LOG POLICIES
-- =====================================================

-- Admins can view audit logs for their facility
CREATE POLICY "Admins can view facility audit logs"
  ON audit_log FOR SELECT
  USING (
    is_admin_or_above() AND 
    (table_name = 'profiles' OR 
     EXISTS (
       SELECT 1 FROM stock_movements sm 
       WHERE sm.id::text = record_id::text AND has_facility_access(sm.facility_id)
     ))
  );

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (TRUE);

-- =====================================================
-- FEEDBACK POLICIES
-- =====================================================

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (user_id = auth.uid());

-- Users can submit feedback
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON feedback FOR SELECT
  USING (is_admin_or_above());

-- Admins can update feedback status
CREATE POLICY "Admins can update feedback"
  ON feedback FOR UPDATE
  USING (is_admin_or_above())
  WITH CHECK (is_admin_or_above());

-- =====================================================
-- SEARCH_LOGS POLICIES
-- =====================================================

-- Anonymous - anyone can insert (no user_id stored)
CREATE POLICY "Anyone can log searches"
  ON search_logs FOR INSERT
  WITH CHECK (TRUE);

-- Only super admins can view search logs
CREATE POLICY "Super admins can view search logs"
  ON search_logs FOR SELECT
  USING (get_user_role() IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV'));

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on sequences
DO $$ BEGIN
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
EXCEPTION
    WHEN others THEN null;
END $$;

-- Grant execute on functions
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
  GRANT EXECUTE ON FUNCTION get_user_facility() TO authenticated;
  GRANT EXECUTE ON FUNCTION has_facility_access(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION is_admin_or_above() TO authenticated;
  GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;
EXCEPTION
    WHEN others THEN null;
END $$;
