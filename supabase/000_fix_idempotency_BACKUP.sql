-- Migration Fix Script: Make all migrations idempotent
-- This script adds DROP IF EXISTS statements to all migrations

-- ========================================
-- FIX: 002_rls_policies.sql
-- ========================================
-- Add DROP POLICY IF EXISTS before all CREATE POLICY statements

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
DROP POLICY IF EXISTS "Staff can view facility analytics" ON analytics;
DROP POLICY IF EXISTS "System can insert analytics" ON analytics;

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
DROP POLICY IF EXISTS "Users can view own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can submit feedback" ON user_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON user_feedback;

-- ========================================
-- FIX: 017_backend_fixes.sql
-- ========================================
-- Add DROP POLICY IF EXISTS for audit_logs

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- ========================================
-- INSTRUCTIONS
-- ========================================
-- This script should be run BEFORE applying migrations.
-- Alternatively, modify the migration files directly to include these DROP statements.
