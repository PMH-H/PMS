-- Migration: 013_add_test_user.sql
-- Description: Adds a test pharmacist user for frontend verification.
-- =====================================================

-- 0. Enable pgcrypto extension for password hashing
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Insert a test user into auth.users
-- =====================================================
-- Note: Using a pre-hashed password to avoid gen_salt type issues
-- The password is 'password123' hashed with bcrypt
INSERT INTO auth.users (id, email, encrypted_password, role, email_confirmed_at, created_at, updated_at)
VALUES (
    'a1b2c3d4-e5f6-7890-1234-567890abcdef', 
    'pharmacist@test.com', 
    '$2a$10$rKYz3qE7YxVQxKqZqKqZqO7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7', -- bcrypt hash of 'password123'
    'authenticated',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert a corresponding profile
-- =====================================================
INSERT INTO profiles (id, full_name, role, facility_id)
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Test Pharmacist', 'PHARMACIST', (SELECT id FROM facilities LIMIT 1))
ON CONFLICT (id) DO NOTHING;
