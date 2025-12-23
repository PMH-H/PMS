
-- Debug Rx Data
\x off
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, status, medications FROM prescriptions ORDER BY created_at DESC LIMIT 5 LOOP
        INSERT INTO qa_results (test_name, result, details) 
        VALUES ('RxDebug', r.status, format('ID: %s, Meds: %s', r.id, r.medications::text));
    END LOOP;
END $$;
