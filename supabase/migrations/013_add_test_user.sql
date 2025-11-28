-- Migration: 013_add_test_user.sql
-- Description: Adds a test pharmacist user for frontend verification.
-- =====================================================

-- 1. Insert a test user into auth.users
-- =====================================================
INSERT INTO auth.users (id, email, encrypted_password, role)
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'pharmacist@test.com', crypt('password123', gen_salt('bf')), 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert a corresponding profile
-- =====================================================
INSERT INTO profiles (id, full_name, role, facility_id)
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Test Pharmacist', 'PHARMACIST', (SELECT id FROM facilities LIMIT 1))
ON CONFLICT (id) DO NOTHING;
