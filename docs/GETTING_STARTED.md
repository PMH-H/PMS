# 🚀 Getting Started Checklist

## Phase 1: Setup (15 minutes)

### Prerequisites
- [ ] Supabase project active
- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Project linked (`supabase link`)
- [ ] Node.js 16+ installed
- [ ] npm or yarn available

### Verification
```bash
# Verify setup
supabase projects list
supabase status
npm --version
```

## Phase 2: Database Migration (10 minutes)

### Apply Migration
- [ ] Navigate to project root: `cd /path/to/pharmai`
- [ ] Run migration: `supabase db push`
- [ ] Wait for completion (should show "Migrations applied")

### Verify Tables Created
```bash
# Run in Supabase SQL editor:
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'store_%' 
    OR table_name LIKE 'notification%' 
    OR table_name LIKE 'channel_%' 
    OR table_name LIKE 'health_%' 
    OR table_name LIKE 'broadcast%');

# Should return: 12
```

- [ ] All 12 tables created
- [ ] RLS enabled on all tables
- [ ] Indexes created
- [ ] Triggers active

## Phase 3: Code Verification (5 minutes)

### Compile Check
```bash
npm run build  # Should complete without errors
npm run type-check  # Should show 0 errors
```

- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Build succeeds

### Files Verification
```bash
# Verify new files exist
ls -la src/components/StoreProductManager.tsx
ls -la src/components/HealthNewsWidget.tsx
ls -la src/components/UserChannelsWidget.tsx
ls -la src/components/NotificationManager.tsx
ls -la src/components/ComprehensiveMetricsDashboard.tsx
ls -la supabase/migrations/047_store_notifications_news_channels.sql
```

- [ ] All 5 component files exist
- [ ] Migration file exists
- [ ] Services file updated
- [ ] Types file updated

## Phase 4: Component Integration (30 minutes)

### Choose Integration Path

**Option A: Minimal (Add to existing dashboards)**
- [ ] Add `StoreProductManager` to AdminDashboard
- [ ] Add `NotificationManager` to PatientDashboard
- [ ] Add `ComprehensiveMetricsDashboard` to AdminDashboard

**Option B: Complete (Full feature rollout)**
- [ ] Add all components to respective dashboards
- [ ] Update AppContext with new state
- [ ] Add navigation menu items
- [ ] Test all features

### Import Components
```tsx
// In your dashboard file:
import { StoreProductManager } from '@/components/StoreProductManager';
import { HealthNewsWidget } from '@/components/HealthNewsWidget';
import { UserChannelsWidget } from '@/components/UserChannelsWidget';
import { NotificationManager } from '@/components/NotificationManager';
import { ComprehensiveMetricsDashboard } from '@/components/ComprehensiveMetricsDashboard';
```

- [ ] Imports added
- [ ] Components placed in JSX
- [ ] Build still succeeds
- [ ] No console errors

## Phase 5: Testing (45 minutes)

### Create Test Data

**Test 1: Create Product**
```
1. Open Admin Dashboard
2. Find "Store Products" section
3. Click "Add Product"
4. Fill in:
   - Name: "Test Product"
   - Category: "OTC_MEDICINES"
   - SKU: "TEST-001"
   - Price: "500" (= $5.00)
   - Stock: "100"
5. Click "Create Product"
6. Verify product appears in list
```

- [ ] Product created successfully
- [ ] Product appears in list
- [ ] Filters work
- [ ] Edit works
- [ ] Delete works (soft delete)

**Test 2: Create Health Article**
```
1. Open Patient Dashboard
2. Find "Health News" section
3. Click "New Article"
4. Fill in:
   - Title: "Understanding Diabetes"
   - Category: "DISEASE"
   - Content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor..."
5. Click "Create Article"
6. Verify article appears in list
7. Toggle "Publish" to make visible
```

- [ ] Article created
- [ ] Article appears in list
- [ ] Publish toggle works
- [ ] Search works
- [ ] Filter by category works

**Test 3: Create Channel**
```
1. Open Community/Channels page
2. Click "+" to create channel
3. Fill in:
   - Name: "Health Tips"
   - Type: "PUBLIC"
   - Description: "Share health tips and wellness advice"
4. Click "Create Channel"
5. Verify channel appears
6. Join channel
7. Send test message
```

- [ ] Channel created
- [ ] Can join/leave
- [ ] Messages persist
- [ ] Real-time updates work (if configured)
- [ ] Member list updates

**Test 4: Notifications**
```
1. Open Notifications page
2. Check unread count
3. Click to mark as read
4. Check preferences
5. Toggle notification types
```

- [ ] Notification list shows
- [ ] Mark as read works
- [ ] Preferences save
- [ ] Statistics accurate

**Test 5: Metrics Dashboard**
```
1. Open Admin Dashboard
2. Find "Metrics Dashboard"
3. Check date range selector
4. Verify charts load
5. Check KPI cards
```

- [ ] Charts render
- [ ] Date filtering works
- [ ] Data displays correctly
- [ ] No console errors

### Test RLS Security

```sql
-- Test as different users to verify RLS

-- As Patient: Can only see own notifications
SELECT COUNT(*) FROM user_notifications 
WHERE user_id = auth.uid();

-- As Admin: Can see products for their facility
SELECT COUNT(*) FROM store_products 
WHERE facility_id = (SELECT facility_id FROM profiles WHERE id = auth.uid());

-- As Non-member: Cannot see private channels
SELECT * FROM user_channels 
WHERE type = 'PRIVATE' AND creator_id != auth.uid();
```

- [ ] Patients see only own data
- [ ] Admins see facility data
- [ ] Non-members can't access private content
- [ ] No permission denied errors

## Phase 6: Production Preparation (30 minutes)

### Backup
```bash
# Take database backup
supabase db pull > backup_$(date +%Y%m%d_%H%M%S).sql

# Store backup safely
mv backup_*.sql ../backups/
```

- [ ] Backup taken
- [ ] Backup verified
- [ ] Stored safely
- [ ] Can be restored if needed

### Documentation
- [ ] Read INTEGRATION_GUIDE.md
- [ ] Read DEVELOPER_REFERENCE.md
- [ ] Review FEATURE_SUMMARY.md
- [ ] Bookmark MIGRATION_DEPLOYMENT_GUIDE.md

### Configuration
- [ ] Set up error logging
- [ ] Configure monitoring
- [ ] Set environment variables
- [ ] Update API keys if needed

### Performance Check
```bash
npm run build  # Final build
npm start      # Start dev server
# Open DevTools > Performance tab
# Test page load time (target: < 2s)
```

- [ ] Build optimized
- [ ] Page loads < 2 seconds
- [ ] No console warnings
- [ ] No layout shifts (CLS < 0.1)

## Phase 7: Deployment (varies by platform)

### If Using Vercel
```bash
# Push to Git
git add .
git commit -m "feat: add store, notifications, channels, metrics"
git push origin main

# Automatic deployment to Vercel
# Monitor deployment in Vercel dashboard
```

- [ ] Code pushed to Git
- [ ] Deployment triggered
- [ ] Build succeeds
- [ ] Preview URL accessible
- [ ] All features working

### If Using Docker
```bash
# Build Docker image
docker build -t pharmai .

# Tag image
docker tag pharmai yourregistry/pharmai:latest

# Push to registry
docker push yourregistry/pharmai:latest

# Deploy to container orchestration
# (K8s, Docker Compose, etc.)
```

- [ ] Docker image built
- [ ] Image pushed
- [ ] Container running
- [ ] Health checks passing

### If Self-Hosted
```bash
# Build for production
npm run build

# Copy dist folder to server
scp -r dist/ user@server:/app/

# Restart application server
ssh user@server 'systemctl restart pharmai'

# Verify deployment
curl https://yourserver/
```

- [ ] Build created
- [ ] Files uploaded
- [ ] Service restarted
- [ ] Site accessible

## Phase 8: Post-Deployment (24 hours)

### Monitor
```sql
-- Check for errors
SELECT * FROM audit_log 
WHERE created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC;

-- Check performance
SELECT query, calls, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%store_%' OR query LIKE '%notification%' 
ORDER BY mean_time DESC LIMIT 10;
```

- [ ] Monitor error logs
- [ ] Check query performance
- [ ] Monitor uptime
- [ ] Review user feedback

### Verification
- [ ] All features working
- [ ] No errors in logs
- [ ] Response times acceptable
- [ ] No data corruption
- [ ] RLS policies enforced

### Communication
- [ ] Notify users of new features
- [ ] Provide user guides
- [ ] Monitor support tickets
- [ ] Gather feedback
- [ ] Plan improvements

## Troubleshooting During Setup

### Issue: Migration fails
```bash
# Check logs
supabase status

# Reset local database
supabase db reset

# Try again
supabase db push
```

### Issue: Components not rendering
```bash
# Check for console errors
# Verify AppContext provider exists
# Check TypeScript types
npm run type-check
```

### Issue: RLS permission denied
```sql
-- Check user profile
SELECT * FROM profiles WHERE id = auth.uid();

-- Verify facility_id is set
UPDATE profiles SET facility_id = 'FACILITY_UUID' 
WHERE id = auth.uid();
```

### Issue: Slow queries
```sql
-- Check indexes
SELECT * FROM pg_stat_user_indexes 
WHERE schemaname = 'public';

-- Add missing index
CREATE INDEX idx_store_products_facility 
ON store_products(facility_id);
```

## Quick Reference

### File Locations
```
src/components/
├── StoreProductManager.tsx      (Products CRUD)
├── HealthNewsWidget.tsx         (Health articles)
├── UserChannelsWidget.tsx       (Community channels)
├── NotificationManager.tsx      (Notifications)
└── ComprehensiveMetricsDashboard.tsx (Analytics)

src/services/
└── database.ts                  (Updated with 40+ functions)

supabase/migrations/
└── 047_store_notifications_news_channels.sql (12 tables, RLS)

Documentation/
├── FEATURE_SUMMARY.md           (What you got)
├── INTEGRATION_GUIDE.md         (How to integrate)
├── DEVELOPER_REFERENCE.md       (Developer guide)
├── MIGRATION_DEPLOYMENT_GUIDE.md (Deployment help)
└── IMPLEMENTATION_SUMMARY.md    (Implementation details)
```

### Important Commands
```bash
# Apply migration
supabase db push

# Check status
supabase status

# View logs
supabase functions list

# Local testing
npm run dev

# Build
npm run build

# Type check
npm run type-check
```

### Key Tables
```
store_products          → Product catalog
store_orders            → Customer orders
user_notifications      → Notifications inbox
notification_preferences → Notification settings
health_articles         → Health content
user_channels           → Community channels
channel_memberships     → Channel membership
channel_messages        → Channel messages
broadcasts              → Broadcast messages
store_metrics           → Revenue analytics
channel_metrics         → Engagement metrics
system_metrics          → System health
```

## Success Criteria

You'll know you're done when:

- ✅ All 5 components render without errors
- ✅ Can create and edit products
- ✅ Can publish health articles
- ✅ Can create and use channels
- ✅ Notifications appear correctly
- ✅ Analytics dashboard shows data
- ✅ All RLS policies enforced
- ✅ No console errors
- ✅ Page load time < 2 seconds
- ✅ Team knows how to use new features

## Support Contacts

- **Database Issues:** Check MIGRATION_DEPLOYMENT_GUIDE.md
- **Integration Issues:** Check INTEGRATION_GUIDE.md
- **Code Issues:** Check DEVELOPER_REFERENCE.md
- **Implementation Details:** Check IMPLEMENTATION_SUMMARY.md
- **Feature Usage:** Check FEATURE_SUMMARY.md

## Next Phases (Optional)

After getting this working, you can:

1. **Add Real-time Updates** - WebSocket subscriptions
2. **Email Notifications** - Sendgrid integration
3. **SMS Alerts** - Twilio integration
4. **Advanced Analytics** - ML-powered insights
5. **Mobile App** - React Native version
6. **Payment Processing** - Stripe integration
7. **Inventory Automation** - Predictive ordering

---

## 🎉 You're Ready!

Follow this checklist step by step, and you'll have a fully functional pharmacy platform with store, notifications, health news, community channels, and analytics.

**Estimated total time: 2-3 hours**

Questions? Check the documentation or review the code comments.

**Let's go! 🚀**
