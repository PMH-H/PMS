
-- Test Report RPC
\x on
SELECT * FROM inventory.get_inventory_valuation((SELECT id FROM facilities LIMIT 1));
