-- Migration: 034_fix_storage_policies.sql
-- Description: Allow public read access to prescription images (or at least for authenticated users)

-- Ensure the bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Prescription images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own prescription images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view all prescription images" ON storage.objects;

-- 1. Allow public read access to the 'prescriptions' bucket
-- This is the simplest way to ensure images load in the UI for all authorized users
CREATE POLICY "Prescription images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'prescriptions');

-- 2. Allow authenticated users to upload to the 'prescriptions' bucket
CREATE POLICY "Users can upload prescription images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prescriptions' 
    AND auth.role() = 'authenticated'
  );

-- 3. Allow users to update/delete their own images (optional, but good for cleanup)
CREATE POLICY "Users can update own prescription images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'prescriptions' 
    AND auth.uid() = owner
  );
