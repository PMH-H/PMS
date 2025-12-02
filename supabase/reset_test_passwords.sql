-- Reset Passwords for Existing Test Users
-- This script updates the encrypted_password for all test users to use password123
-- Run this via Supabase SQL Editor or db push
-- =====================================================

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update all existing test users to have password: password123
-- The bcrypt hash below is for 'password123'
UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf')),
    updated_at = NOW()
WHERE email IN (
    'admin@pharmai.com',
    'bms@pharmai.com',
    'customer@gmail.com',
    'dev@pharmai.com',
    'patient@pharmai.com',
    'pharmacist@pharmai.com'
);

-- Verify the update
SELECT email, id, created_at, updated_at
FROM auth.users
WHERE email IN (
    'admin@pharmai.com',
    'bms@pharmai.com',
    'customer@gmail.com',
    'dev@pharmai.com',
    'patient@pharmai.com',
    'pharmacist@pharmai.com'
)
ORDER BY email;

-- Summary:
-- All test users now have password: password123
-- You can login with any of these emails:
--   - admin@pharmai.com
--   - bms@pharmai.com  
--   - customer@gmail.com
--   - dev@pharmai.com
--   - patient@pharmai.com
--   - pharmacist@pharmai.com
