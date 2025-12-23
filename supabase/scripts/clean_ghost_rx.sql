
-- Cleanup Ghost Prescriptions
\x off
DELETE FROM prescriptions 
WHERE (medications IS NULL OR jsonb_array_length(medications) = 0)
AND (manual_entry IS NULL OR manual_entry = '');

SELECT * FROM prescriptions ORDER BY created_at DESC LIMIT 5;
