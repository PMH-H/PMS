SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'facilities' AND column_name = 'owner_id';
