
-- Verify store_products column content
\x off
DO $$
DECLARE
    r RECORD;
BEGIN
    INSERT INTO qa_results (test_name, result, details) 
    VALUES ('PriceCheck', 'INFO', 'Checking RLS and column type');

    -- Attempt to insert a product to check constraint
    -- Note: This is an RLS check largely
    -- Just logging column info detail again to be super sure about 'price_cents'
    
    FOR r IN SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'store_products' LOOP
       RAISE NOTICE '% - %', r.column_name, r.data_type;
    END LOOP;

END $$;
