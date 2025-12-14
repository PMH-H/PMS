-- Migration: 044_add_unique_constraint.sql
-- Purpose: Add UNIQUE constraint to clinical_drugs(name) to support UPSERT.

-- Ideally names are unique. If duplicates exist from previous bad seeds, this might fail.
-- We can try to cleanup duplicates first if needed, but assuming relatively clean state since we just started.
-- (Propofol was inserted once in 042, and maybe again if 042 ran multiple times without conflict check?)
-- 042 didn't used UPSERT? 042 likely failed or succeeded once.

ALTER TABLE public.clinical_drugs
ADD CONSTRAINT clinical_drugs_name_key UNIQUE (name);
