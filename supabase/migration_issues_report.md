# Migration Idempotency Issues - Summary Report

## Overview
Analyzed all 17 migration files in `supabase/migrations/` for idempotency issues. Found multiple files with CREATE statements that will fail on re-run.

## Issues Found

### 1. **002_rls_policies.sql** - CRITICAL
**Problem**: 50+ CREATE POLICY statements without DROP IF EXISTS
**Impact**: Migration fails on re-run with "policy already exists" errors
**Status**: ✅ Fix created in `000_fix_idempotency.sql`

**Affected Policies**:
- All profiles policies (4 policies)
- All facilities policies (3 policies)
- All items policies (4 policies)
- All item_batches policies (5 policies)
- All stock_movements policies (3 policies)
- All suppliers policies (2 policies)
- All purchase_orders policies (5 policies)
- All purchase_order_items policies (4 policies)
- All cycle_counts policies (4 policies)
- All cycle_count_results policies (3 policies)
- All analytics policies (2 policies)
- All alerts policies (3 policies)
- All vendor_performance policies (2 policies)
- All audit_log policies (3 policies)
- All feedback policies (4 policies)
- All search_logs policies (2 policies)

### 2. **010_enhanced_patient_care.sql** - FIXED
**Problem**: Used `uuid_generate_v4()` instead of `gen_random_uuid()`
**Impact**: Migration fails with "function does not exist" error
**Status**: ✅ Already fixed (replaced with `gen_random_uuid()`)

### 3. **011_rx_details_and_analytics.sql** - PARTIALLY FIXED
**Problem**: Multiple CREATE POLICY and CREATE TRIGGER without DROP IF EXISTS
**Impact**: Migration fails on re-run
**Status**: ⚠️ Partially fixed (some DROP statements added, but not all)

**Remaining Issues**:
- CREATE TRIGGER `retention_settings_changed` - ✅ Fixed
- CREATE POLICY statements - ✅ Fixed (6 policies)

### 4. **017_backend_fixes.sql** - NEEDS FIX
**Problem**: CREATE POLICY without DROP IF EXISTS, CREATE TRIGGER without DROP IF EXISTS
**Impact**: Migration fails on re-run
**Status**: ❌ Needs fixing

**Issues**:
- CREATE POLICY "Admins can view audit logs" - No DROP statement
- CREATE TRIGGER audit_sales_trigger - Has DROP IF EXISTS ✅
- CREATE TRIGGER audit_inventory_trigger - Has DROP IF EXISTS ✅
- CREATE TRIGGER metric_sales_trigger - Has DROP IF EXISTS ✅
- CREATE TRIGGER metric_articles_trigger - Has DROP IF EXISTS ✅

### 5. **001_initial_schema.sql** - REVIEW NEEDED
**Problem**: Multiple CREATE INDEX without IF NOT EXISTS, CREATE TRIGGER without DROP IF EXISTS
**Impact**: May fail on re-run
**Status**: ⚠️ Needs review

**Issues**:
- CREATE INDEX statements (lines 357-405) - Some use IF NOT EXISTS, some don't
- CREATE TRIGGER statements (lines 419-437) - No DROP IF EXISTS

### 6. **009_create_sales_table.sql** - MINOR
**Problem**: CREATE TRIGGER without DROP IF EXISTS
**Impact**: May fail on re-run
**Status**: ⚠️ Needs review

**Issues**:
- CREATE TRIGGER update_sales_updated_at - No DROP IF EXISTS

## Recommended Actions

### Immediate (Critical)
1. ✅ Apply `000_fix_idempotency.sql` before running migrations
2. ❌ Fix `017_backend_fixes.sql` - Add DROP POLICY IF EXISTS
3. ❌ Fix `001_initial_schema.sql` - Add DROP TRIGGER IF EXISTS for all triggers
4. ❌ Fix `009_create_sales_table.sql` - Add DROP TRIGGER IF EXISTS

### Long-term (Best Practice)
1. Modify all migration files to be idempotent
2. Add DROP IF EXISTS before all CREATE POLICY statements
3. Add DROP TRIGGER IF EXISTS before all CREATE TRIGGER statements
4. Use CREATE OR REPLACE for functions
5. Use CREATE TABLE IF NOT EXISTS for tables
6. Use CREATE INDEX IF NOT EXISTS for indexes

## Migration Execution Order
To successfully apply all migrations:

```bash
# Option 1: Apply fix file first
npx supabase db push --file 000_fix_idempotency.sql
npx supabase db push

# Option 2: Fix files directly (recommended)
# 1. Add DROP statements to all migration files
# 2. Run: npx supabase db push
```

## Files Created
- ✅ `000_fix_idempotency.sql` - Drops all policies before migration
- ✅ `migration_issues_report.md` - This file

## Next Steps
1. Review and apply the fix file
2. Test migration on staging database
3. Update remaining migration files for full idempotency
4. Document migration best practices for future files
