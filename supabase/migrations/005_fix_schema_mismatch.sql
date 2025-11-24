-- Fix schema mismatch between frontend types and database
-- Rename 'unit' to 'default_unit' and add missing columns

-- Rename unit column to default_unit
ALTER TABLE items RENAME COLUMN unit TO default_unit;

-- Add price_estimate column if it doesn't exist
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_estimate NUMERIC(10,2);

-- Add image columns if they don't exist (they should already exist from 001)
-- ALTER TABLE items ADD COLUMN IF NOT EXISTS image_front TEXT;
-- ALTER TABLE items ADD COLUMN IF NOT EXISTS image_back TEXT;

-- Update any existing data to ensure default_unit is not null
UPDATE items SET default_unit = 'units' WHERE default_unit IS NULL OR default_unit = '';
