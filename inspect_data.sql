-- Check if we have any facilities
SELECT count(*) as facility_count FROM facilities;

-- Check if we have any items
SELECT count(*) as item_count FROM items;

-- Check if we have any batches, and how many are missing facility_id (if even possible per schema)
-- Note: schema says facility_id is NOT NULL, but let's check if they point to valid facilities
SELECT count(*) as batch_count FROM item_batches;
SELECT count(*) as orphaned_batches FROM item_batches WHERE facility_id NOT IN (SELECT id FROM facilities);

-- Check profiles without facilities
SELECT count(*) as unlinked_profiles FROM profiles WHERE facility_id IS NULL AND role != 'CUSTOMER';
