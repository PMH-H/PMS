
-- Read Schema Results
\x off
SELECT result, details FROM qa_results WHERE test_name = 'SchemaCheck' ORDER BY created_at DESC;
