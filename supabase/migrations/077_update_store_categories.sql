-- Migration: 077_update_store_categories.sql
-- Purpose: Add 'AGROVET' and 'MEDSURGE' to store_products category check constraint to match UI.

ALTER TABLE public.store_products 
DROP CONSTRAINT IF EXISTS store_products_category_check;

ALTER TABLE public.store_products 
ADD CONSTRAINT store_products_category_check 
CHECK (category IN (
    'OTC_MEDICINES', 
    'COSMETICS', 
    'SUPPLEMENTS', 
    'PERSONAL_CARE', 
    'WELLNESS', 
    'FIRST_AID',
    'AGROVET',
    'MEDSURGE'
));
