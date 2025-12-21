SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_metrics_summary' 
ORDER BY ordinal_position;
