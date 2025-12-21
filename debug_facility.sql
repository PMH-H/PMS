-- Check if facility exists
SELECT * FROM facilities WHERE id = '030bf3c1-2f01-4fac-8bb3-b038e2cb0c9f';

-- Check policies again
SELECT policyname, qual, cmd FROM pg_policies WHERE tablename = 'facilities';

-- Check if authenticated user can see it (simulation not easy in script without auth, but policies tell us)
