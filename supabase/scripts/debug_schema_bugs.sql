
-- Debug Schema for Bugs
\x off

-- 1. Check store_products columns
INSERT INTO qa_results (test_name, result, details)
SELECT 'SchemaCheck', 'store_products', column_name || ' (' || data_type || ')'
FROM information_schema.columns 
WHERE table_name = 'store_products';

-- 2. Check messages columns
INSERT INTO qa_results (test_name, result, details)
SELECT 'SchemaCheck', 'messages', column_name || ' (' || data_type || ')'
FROM information_schema.columns 
WHERE table_name = 'messages';

SELECT * FROM qa_results WHERE test_name = 'SchemaCheck' ORDER BY created_at DESC;
