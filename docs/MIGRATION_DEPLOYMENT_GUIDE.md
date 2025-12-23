# Migration & Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Validation
- [ ] Supabase project is active
- [ ] Database connection string is valid
- [ ] Supabase CLI is installed (`supabase --version`)
- [ ] Project is linked (`supabase link`)
- [ ] Node.js 16+ installed

### 2. Code Validation
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] All imports resolve correctly
- [ ] Type definitions are exported

### 3. Database Backup
- [ ] Take backup of current database
  ```bash
  supabase db pull
  ```
- [ ] Store backup safely
- [ ] Verify backup integrity

## Migration Deployment Steps

### Step 1: Apply Migration

```bash
# Navigate to project root
cd /path/to/pharmai

# Push migration to Supabase
supabase db push

# If using local development
supabase db reset  # Resets local database with all migrations
```

### Step 2: Verify Tables

```bash
# List all new tables
supabase db list

# Connect to Supabase database and run:
```

**SQL Verification Query:**
```sql
-- Verify all new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'store_%' 
    OR table_name LIKE 'notification%' 
    OR table_name LIKE 'channel_%' 
    OR table_name LIKE 'health_%' 
    OR table_name LIKE 'broadcast%'
    OR table_name LIKE '%metric%')
ORDER BY table_name;

-- Expected output (12 tables):
-- broadcast
-- channel_memberships
-- channel_messages
-- health_articles
-- notification_preferences
-- store_metrics
-- store_orders
-- store_products
-- system_metrics
-- user_channels
-- user_notifications
-- channel_metrics
```

### Step 3: Verify RLS Policies

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND (tablename LIKE 'store_%' 
    OR tablename LIKE 'notification%' 
    OR tablename LIKE 'channel_%' 
    OR tablename LIKE 'health_%' 
    OR tablename LIKE 'broadcast%')
ORDER BY tablename;

-- All should show 'true' for rowsecurity
```

### Step 4: Check Indexes

```sql
-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN (
    'store_products', 'store_orders', 'user_notifications',
    'notification_preferences', 'health_articles', 'user_channels',
    'channel_memberships', 'channel_messages', 'broadcasts',
    'store_metrics', 'channel_metrics', 'system_metrics'
  )
ORDER BY tablename, indexname;
```

### Step 5: Test RLS Policies

```bash
# Create test user in Supabase Auth
# Then test each role's access:
```

**Test as Patient:**
```sql
-- Should see only own notifications
SELECT * FROM user_notifications 
WHERE user_id = auth.uid();

-- Should see published articles
SELECT * FROM health_articles 
WHERE is_published = true;

-- Should see public channels they're member of
SELECT * FROM user_channels 
WHERE type = 'PUBLIC' OR id IN (
  SELECT channel_id FROM channel_memberships 
  WHERE user_id = auth.uid()
);
```

**Test as Admin:**
```sql
-- Should see all products for facility
SELECT * FROM store_products 
WHERE facility_id = (
  SELECT facility_id FROM profiles 
  WHERE id = auth.uid()
);

-- Should see all orders for facility
SELECT * FROM store_orders 
WHERE facility_id = (
  SELECT facility_id FROM profiles 
  WHERE id = auth.uid()
);

-- Should see metrics for facility
SELECT * FROM store_metrics 
WHERE facility_id = (
  SELECT facility_id FROM profiles 
  WHERE id = auth.uid()
);
```

## Troubleshooting

### Issue: "Migration not found" error

**Solution:**
```bash
# Verify migration file exists
ls supabase/migrations/047_store_notifications_news_channels.sql

# Check migration status
supabase migration list

# If needed, manually create migration
supabase migration new store_and_notifications
```

### Issue: "Permission denied" on create table

**Solution:**
```bash
# Ensure you have superuser role
# Run as superuser in Supabase dashboard

# Or reset and apply fresh
supabase db reset
supabase db push
```

### Issue: "RLS policy denies access" after deployment

**Causes & Solutions:**

1. **User facility_id doesn't match**
   ```sql
   -- Check user has facility_id set
   SELECT id, email, facility_id, role FROM profiles 
   WHERE id = auth.uid();
   
   -- If NULL, update:
   UPDATE profiles 
   SET facility_id = 'YOUR_FACILITY_ID' 
   WHERE id = auth.uid();
   ```

2. **User role not set correctly**
   ```sql
   -- Check user role
   SELECT id, email, role FROM profiles 
   WHERE id = auth.uid();
   
   -- Valid roles: patient, pharmacist, admin, prescriber, super_admin_dev
   ```

3. **Table RLS not enabled**
   ```sql
   -- Enable RLS on table
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   
   -- Check RLS status
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'table_name';
   ```

### Issue: Slow queries after migration

**Solutions:**

1. **Add missing indexes:**
   ```sql
   -- Check existing indexes
   SELECT * FROM pg_stat_user_indexes 
   WHERE schemaname = 'public';
   
   -- Add index on frequently filtered columns
   CREATE INDEX idx_store_products_facility_active 
   ON store_products(facility_id, is_active);
   ```

2. **Analyze query performance:**
   ```sql
   -- Check explain plan
   EXPLAIN ANALYZE 
   SELECT * FROM store_products 
   WHERE facility_id = 'abc-def' AND is_active = true;
   ```

3. **Optimize RLS policies:**
   - Minimize joins in RLS conditions
   - Use indexed columns in WHERE clauses
   - Consider caching for frequently checked values

### Issue: Audit logs not recording

**Solution:**
```sql
-- Check trigger status
SELECT trigger_name, trigger_schema, trigger_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_table IN ('store_products', 'store_orders', 'health_articles');

-- If missing, recreate trigger:
CREATE TRIGGER audit_store_products 
AFTER INSERT OR UPDATE OR DELETE ON store_products
FOR EACH ROW 
EXECUTE FUNCTION log_store_audit();
```

### Issue: Notifications not creating

**Solution:**
```sql
-- Check notification preferences exist
SELECT * FROM notification_preferences 
WHERE user_id = 'USER_ID';

-- If missing, create:
INSERT INTO notification_preferences (user_id) 
VALUES ('USER_ID');

-- Check notification preferences allow notification type
SELECT order_updates, health_alerts, news, channel_messages, promotions 
FROM notification_preferences 
WHERE user_id = 'USER_ID';

-- If disabled, update:
UPDATE notification_preferences 
SET order_updates = true 
WHERE user_id = 'USER_ID';
```

### Issue: Channels not appearing in list

**Causes & Solutions:**

1. **Channel is_active = false:**
   ```sql
   -- Check channel status
   SELECT id, name, is_active FROM user_channels 
   WHERE id = 'CHANNEL_ID';
   
   -- If inactive, activate:
   UPDATE user_channels 
   SET is_active = true 
   WHERE id = 'CHANNEL_ID';
   ```

2. **RLS policy hiding channel:**
   ```sql
   -- Check channel type and membership
   SELECT type FROM user_channels 
   WHERE id = 'CHANNEL_ID';
   
   SELECT * FROM channel_memberships 
   WHERE channel_id = 'CHANNEL_ID' 
    AND user_id = auth.uid();
   ```

### Issue: Metrics data not showing

**Solutions:**

1. **Check data exists:**
   ```sql
   -- Verify metrics records
   SELECT COUNT(*) FROM store_metrics 
   WHERE facility_id = 'FACILITY_ID';
   
   -- Check date range
   SELECT MIN(date), MAX(date) FROM store_metrics 
   WHERE facility_id = 'FACILITY_ID';
   ```

2. **Insert test data:**
   ```sql
   INSERT INTO store_metrics (
     date, facility_id, total_orders, total_revenue_cents, 
     avg_order_value_cents, category_breakdown
   ) VALUES (
     NOW()::date,
     'FACILITY_ID',
     10,
     50000,
     5000,
     '{"OTC_MEDICINES": 5, "COSMETICS": 5}'::jsonb
   );
   ```

## Rollback Procedures

### If Migration Fails

```bash
# Method 1: Reset local database
supabase db reset

# Method 2: Manual rollback (creates new migration)
supabase migration new rollback_store_notifications

# In the new migration file, add DROP TABLE statements:
```

**Rollback SQL:**
```sql
-- Drop triggers first
DROP TRIGGER IF EXISTS audit_store_products ON store_products;
DROP TRIGGER IF EXISTS audit_store_orders ON store_orders;
-- ... etc

-- Drop tables in reverse order
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS channel_metrics CASCADE;
DROP TABLE IF EXISTS store_metrics CASCADE;
DROP TABLE IF EXISTS broadcasts CASCADE;
DROP TABLE IF EXISTS channel_messages CASCADE;
DROP TABLE IF EXISTS channel_memberships CASCADE;
DROP TABLE IF EXISTS user_channels CASCADE;
DROP TABLE IF EXISTS health_articles CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS store_orders CASCADE;
DROP TABLE IF EXISTS store_products CASCADE;
```

### If Components Fail

```bash
# Remove component files
rm src/components/StoreProductManager.tsx
rm src/components/HealthNewsWidget.tsx
rm src/components/UserChannelsWidget.tsx
rm src/components/NotificationManager.tsx
rm src/components/ComprehensiveMetricsDashboard.tsx

# Revert database.ts changes
git checkout src/services/database.ts

# Revert type definitions
git checkout src/types/index.ts
```

## Validation After Deployment

### Automated Checks

```bash
# Run test suite
npm run test

# Check TypeScript
npm run type-check

# Run linter
npm run lint

# Build check
npm run build
```

### Manual Verification

1. **Create Product:**
   - Navigate to Store Products
   - Fill form and submit
   - Verify product appears in list

2. **Create Article:**
   - Navigate to Health News
   - Write article and publish
   - Verify article appears in list

3. **Create Channel:**
   - Navigate to Channels
   - Create channel and join
   - Send message and verify persistence

4. **Check Notifications:**
   - Create notification via API
   - Verify appears in inbox
   - Test preference controls

5. **View Metrics:**
   - Navigate to Dashboard
   - Check date range filtering works
   - Verify charts render with data

## Performance Monitoring

### Monitor Query Performance

```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%store_%' OR query LIKE '%notification%' 
  OR query LIKE '%channel%'
ORDER BY mean_time DESC 
LIMIT 10;
```

### Monitor Table Sizes

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
  AND (tablename LIKE 'store_%' OR tablename LIKE 'notification%' 
    OR tablename LIKE 'channel_%')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### Monitor Connections

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Connections by role
SELECT usename, count(*) FROM pg_stat_activity 
GROUP BY usename;
```

## Post-Deployment Tasks

- [ ] Run analytics on migration
- [ ] Set up monitoring alerts
- [ ] Update documentation
- [ ] Train team on new features
- [ ] Monitor error logs (24-48 hours)
- [ ] Gather user feedback
- [ ] Optimize based on metrics
- [ ] Schedule regular backups
- [ ] Plan archive strategy for old data

## Support

For issues or questions:

1. Check Supabase logs
2. Review RLS policies
3. Check audit trail
4. Look at browser console for JS errors
5. Check server logs
6. Review database query plans
7. Monitor real-time subscriptions

Contact: [Your Support Channel]
