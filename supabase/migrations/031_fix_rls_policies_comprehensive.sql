-- Migration: 031_fix_rls_policies_comprehensive.sql
-- Description: Fix RLS policies to allow proper data visibility across all user roles

-- ============================================
-- PRESCRIPTIONS - Multi-role access
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Staff can view prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Staff can update prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Patients can create own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "All authenticated users can view prescriptions" ON prescriptions;

-- Patients view their own
CREATE POLICY "Patients view own prescriptions" ON prescriptions
  FOR SELECT USING (
    auth.uid() = patient_id
  );

-- Patients create their own
CREATE POLICY "Patients create own prescriptions" ON prescriptions
  FOR INSERT WITH CHECK (
    auth.uid() = patient_id
  );

-- Pharmacists view all prescriptions (for now - will add proximity routing later)
CREATE POLICY "Pharmacists view all prescriptions" ON prescriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'pharmacist'
    )
  );

-- Pharmacists update prescriptions (approve/reject)
CREATE POLICY "Pharmacists update prescriptions" ON prescriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- Admins view all prescriptions
CREATE POLICY "Admins view all prescriptions" ON prescriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- ============================================
-- CUSTOMER_ORDERS - Multi-role access
-- ============================================

DROP POLICY IF EXISTS "Patients can view own orders" ON customer_orders;
DROP POLICY IF EXISTS "Staff can view orders" ON customer_orders;
DROP POLICY IF EXISTS "Staff can update orders" ON customer_orders;

-- Patients view their own orders
CREATE POLICY "Patients view own orders" ON customer_orders
  FOR SELECT USING (
    auth.uid() = patient_id
  );

-- Patients create their own orders
CREATE POLICY "Patients create own orders" ON customer_orders
  FOR INSERT WITH CHECK (
    auth.uid() = patient_id
  );

-- Pharmacists view facility orders
CREATE POLICY "Pharmacists view facility orders" ON customer_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin')
      AND facility_id = customer_orders.facility_id
    )
  );

-- Pharmacists update facility orders
CREATE POLICY "Pharmacists update facility orders" ON customer_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin')
      AND facility_id = customer_orders.facility_id
    )
  );

-- Super Admins view all orders
CREATE POLICY "Super Admins view all orders" ON customer_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin_bms', 'super_admin_dev')
    )
  );

-- ============================================
-- MESSAGES - Cross-user communication
-- ============================================

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Recipients can update messages" ON messages;

-- Users view messages they sent or received
CREATE POLICY "Users view sent or received messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Users send messages
CREATE POLICY "Users send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

-- Recipients mark messages as read
CREATE POLICY "Recipients update messages" ON messages
  FOR UPDATE USING (
    auth.uid() = recipient_id
  );

-- Super Admins view all messages
CREATE POLICY "Super Admins view all messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin_dev'
    )
  );

-- ============================================
-- ITEMS (Inventory) - Facility-based access
-- ============================================

DROP POLICY IF EXISTS "Staff can view items" ON items;
DROP POLICY IF EXISTS "Staff can manage items" ON items;

-- All authenticated users can view items (for browsing)
CREATE POLICY "All users view items" ON items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Staff can create items
CREATE POLICY "Staff create items" ON items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- Staff can update items
CREATE POLICY "Staff update items" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- ============================================
-- ITEM_BATCHES - Facility-based access
-- ============================================

DROP POLICY IF EXISTS "Staff can view batches" ON item_batches;
DROP POLICY IF EXISTS "Staff can manage batches" ON item_batches;

-- Pharmacists view facility batches
CREATE POLICY "Pharmacists view facility batches" ON item_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin')
      AND facility_id = item_batches.facility_id
    )
  );

-- Pharmacists manage facility batches
CREATE POLICY "Pharmacists manage facility batches" ON item_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin')
      AND facility_id = item_batches.facility_id
    )
  );

-- Super Admins view all batches
CREATE POLICY "Super Admins view all batches" ON item_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin_bms', 'super_admin_dev')
    )
  );

-- ============================================
-- SALES - Facility-based access
-- ============================================

DROP POLICY IF EXISTS "Staff can view sales" ON sales;
DROP POLICY IF EXISTS "Staff can create sales" ON sales;

-- Pharmacists view facility sales
CREATE POLICY "Pharmacists view facility sales" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin')
      AND facility_id = sales.facility_id
    )
  );

-- Pharmacists create facility sales
CREATE POLICY "Pharmacists create facility sales" ON sales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin')
      AND facility_id = sales.facility_id
    )
  );

-- Super Admins view all sales
CREATE POLICY "Super Admins view all sales" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin_bms', 'super_admin_dev')
    )
  );

-- ============================================
-- AUDIT_LOG - Admin access only
-- ============================================

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_log;

-- All authenticated users can insert (for triggers)
CREATE POLICY "All users insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admins view facility audit logs
CREATE POLICY "Admins view facility audit logs" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- ============================================
-- PROMOTIONS - Facility-based access
-- ============================================

DROP POLICY IF EXISTS "All users can view active promotions" ON promotions;
DROP POLICY IF EXISTS "Staff can manage promotions" ON promotions;

-- All users view active promotions
CREATE POLICY "All users view active promotions" ON promotions
  FOR SELECT USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- Admins manage facility promotions
CREATE POLICY "Admins manage facility promotions" ON promotions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
      AND (facility_id = promotions.facility_id OR role IN ('super_admin_bms', 'super_admin_dev'))
    )
  );
5472