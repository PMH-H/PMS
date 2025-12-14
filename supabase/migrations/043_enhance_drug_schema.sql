-- Migration: 043_enhance_drug_schema.sql
-- Purpose: Add rich text columns for monograph data and flexible interaction fields.

-- 1. Enhance clinical_drugs with rich text columns
ALTER TABLE public.clinical_drugs
ADD COLUMN IF NOT EXISTS indications_text TEXT,
ADD COLUMN IF NOT EXISTS contraindications_text TEXT,
ADD COLUMN IF NOT EXISTS adverse_effects_text TEXT,
ADD COLUMN IF NOT EXISTS dosage_text TEXT,
ADD COLUMN IF NOT EXISTS geriatric_use_text TEXT,
ADD COLUMN IF NOT EXISTS pediatric_use_text TEXT,
ADD COLUMN IF NOT EXISTS pregnancy_use_text TEXT,
ADD COLUMN IF NOT EXISTS overdose_text TEXT,
ADD COLUMN IF NOT EXISTS storage_text TEXT;

-- 2. Enhance clinical_interactions to support Class/External interactions
-- We need to make drug_id_2 nullable because some interactions are with "Alcohol" or "Beta Blockers" (a class, not a specific drug row yet)
ALTER TABLE public.clinical_interactions
ALTER COLUMN drug_id_2 DROP NOT NULL;

-- Add columns to describe the interaction partner if it's not a specific local drug ID
ALTER TABLE public.clinical_interactions
ADD COLUMN IF NOT EXISTS interacting_entity_name TEXT; -- e.g., "Alcohol", "Benzodiazepines", "Ketamine" (if ID lookup fails)

-- Add interaction metadata
ALTER TABLE public.clinical_interactions
ADD COLUMN IF NOT EXISTS interaction_type TEXT CHECK (interaction_type IN ('CRITICAL-INTRA', 'MODERATE-INTRA', 'CRITICAL-CLASS', 'MODERATE-CLASS', 'CRITICAL-OUT', 'MODERATE-OUT', 'MINOR-INTRA', 'OUT', 'CLASS'));

-- 3. Relax severity check constraint if needed, or map new types to it.
-- The existing severity check was: CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE', 'CONTRAINDICATED'))
-- The new data uses types like 'CRITICAL-INTRA'. We can keep 'severity' as a high-level summary or drop the constraint.
-- Let's drop the old constraint to be flexible, or add the new values.
ALTER TABLE public.clinical_interactions
DROP CONSTRAINT IF EXISTS clinical_interactions_severity_check;

-- Add a new flexible constraint or just let it be text. Let's strictly map for now if we can, 
-- but 'CRITICAL-INTRA' is more of a type.
-- Let's rely on 'interaction_type' for the systemic logic and keep 'severity' for UI display color (e.g. CRITICAL -> SEVERE).

-- 4. Add index for text search on the new columns?
-- For now, purely purely storage.
