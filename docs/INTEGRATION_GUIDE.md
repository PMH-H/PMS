# Integration Guide - New Pharmacy Features

## Overview

This guide explains how to integrate the new store, notifications, health news, channels, and metrics features into your existing dashboards.

## Component Imports

```typescript
import { StoreProductManager } from '@/components/StoreProductManager';
import { HealthNewsWidget } from '@/components/HealthNewsWidget';
import { UserChannelsWidget } from '@/components/UserChannelsWidget';
import { NotificationManager } from '@/components/NotificationManager';
import { ComprehensiveMetricsDashboard } from '@/components/ComprehensiveMetricsDashboard';
```

## Integration Examples

### 1. Adding to AdminDashboard

```tsx
// src/pages/AdminDashboard.tsx

import { StoreProductManager } from '@/components/StoreProductManager';
import { ComprehensiveMetricsDashboard } from '@/components/ComprehensiveMetricsDashboard';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      {/* Existing components */}
      
      {/* New metrics dashboard */}
      <ComprehensiveMetricsDashboard />
      
      {/* Store management */}
      <StoreProductManager />
      
      {/* Other admin features... */}
    </div>
  );
};
```

### 2. Adding to PatientDashboard

```tsx
// src/pages/PatientDashboard.tsx

import { NotificationManager } from '@/components/NotificationManager';
import { HealthNewsWidget } from '@/components/HealthNewsWidget';
import { UserChannelsWidget } from '@/components/UserChannelsWidget';

export const PatientDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Patient Dashboard</h1>
      
      {/* Notifications */}
      <NotificationManager />
      
      {/* Health news feed */}
      <HealthNewsWidget />
      
      {/* Community channels */}
      <UserChannelsWidget />
      
      {/* Other patient features... */}
    </div>
  );
};
```

### 3. Adding to SuperAdminDashboard

```tsx
// src/pages/SuperAdminDashboard.tsx

import { StoreProductManager } from '@/components/StoreProductManager';
import { ComprehensiveMetricsDashboard } from '@/components/ComprehensiveMetricsDashboard';
import { HealthNewsWidget } from '@/components/HealthNewsWidget';

export const SuperAdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      
      {/* System metrics */}
      <ComprehensiveMetricsDashboard />
      
      {/* Store management */}
      <StoreProductManager />
      
      {/* Health articles management */}
      <HealthNewsWidget />
      
      {/* Dev tools and other features... */}
    </div>
  );
};
```

## Database Setup

### 1. Apply Migration

Run the migration file to create all tables and set up RLS policies:

```bash
supabase db push
```

This will execute: `supabase/migrations/047_store_notifications_news_channels.sql`

### 2. Verify Tables

Check that all tables were created:

```sql
-- In Supabase SQL editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%store_%' OR table_name LIKE '%notification_%' 
OR table_name LIKE '%channel_%' OR table_name LIKE '%health_%' 
OR table_name LIKE '%broadcast%' OR table_name LIKE '%metric%';
```

### 3. Check RLS Policies

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename LIKE 'store_%' OR tablename LIKE 'user_notifications' 
  OR tablename LIKE 'channel_%' OR tablename LIKE 'health_%' 
  OR tablename LIKE 'broadcast%');
```

## AppContext Updates

Update your AppContext to include the new features:

```typescript
// src/context/AppContext.tsx

interface AppContextType {
  // ... existing context
  
  // New store features
  storeProducts: StoreProduct[];
  setStoreProducts: (products: StoreProduct[]) => void;
  
  // New notification features
  notifications: UserNotification[];
  setNotifications: (notifications: UserNotification[]) => void;
  notificationPreferences: NotificationPreference | null;
  setNotificationPreferences: (prefs: NotificationPreference) => void;
  
  // New channels
  userChannels: UserChannel[];
  setUserChannels: (channels: UserChannel[]) => void;
  
  // New health articles
  healthArticles: HealthArticle[];
  setHealthArticles: (articles: HealthArticle[]) => void;
}

export const AppContext = React.createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference | null>(null);
  const [userChannels, setUserChannels] = useState<UserChannel[]>([]);
  const [healthArticles, setHealthArticles] = useState<HealthArticle[]>([]);
  
  const value: AppContextType = {
    // ... existing context values
    storeProducts,
    setStoreProducts,
    notifications,
    setNotifications,
    notificationPreferences,
    setNotificationPreferences,
    userChannels,
    setUserChannels,
    healthArticles,
    setHealthArticles,
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
```

## Real-time Subscriptions (Optional)

To enable real-time updates, add subscriptions to your hooks:

```typescript
// src/hooks/useRealtimeSubscription.ts - Add these subscriptions

import { supabase } from '@/services/supabase';

export const useProductUpdates = (facilityId: string, callback: (product: any) => void) => {
  useEffect(() => {
    const subscription = supabase
      .channel(`store_products:${facilityId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'store_products', filter: `facility_id=eq.${facilityId}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [facilityId, callback]);
};

export const useNotificationUpdates = (userId: string, callback: (notification: any) => void) => {
  useEffect(() => {
    const subscription = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, callback]);
};

export const useChannelMessages = (channelId: string, callback: (message: any) => void) => {
  useEffect(() => {
    const subscription = supabase
      .channel(`channel_messages:${channelId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [channelId, callback]);
};
```

## Feature Documentation

### Store Products

**Main Component:** `StoreProductManager`

**Features:**
- Create, read, update, delete (CRUD) products
- Category filtering (OTC Medicines, Cosmetics, Supplements, etc.)
- SKU management
- Price and stock tracking
- Low stock alerts
- Tag management
- Product search

**Usage Example:**
```tsx
import { StoreProductManager } from '@/components/StoreProductManager';

<StoreProductManager />
```

**Required Context:** facility_id, user.id

### Health News

**Main Component:** `HealthNewsWidget`

**Features:**
- Write health articles
- Publish/draft workflow
- Category classification
- View count tracking
- Author management
- Article search and filtering

**Usage Example:**
```tsx
import { HealthNewsWidget } from '@/components/HealthNewsWidget';

<HealthNewsWidget />
```

**Required Context:** facility_id, user.id, user.role

### User Channels

**Main Component:** `UserChannelsWidget`

**Features:**
- Create channels (public/private/community)
- Join/leave channels
- Channel messaging
- Member management
- Broadcast to members
- Channel search

**Usage Example:**
```tsx
import { UserChannelsWidget } from '@/components/UserChannelsWidget';

<UserChannelsWidget />
```

**Required Context:** facility_id, user.id

### Notifications

**Main Component:** `NotificationManager`

**Features:**
- Notification inbox
- Unread status tracking
- Preference management
- Notification filtering
- Delivery method selection (email, SMS)
- Notification statistics

**Usage Example:**
```tsx
import { NotificationManager } from '@/components/NotificationManager';

<NotificationManager />
```

**Required Context:** user.id

### Metrics Dashboard

**Main Component:** `ComprehensiveMetricsDashboard`

**Features:**
- Revenue tracking and trends
- Order analytics
- System uptime monitoring
- Category distribution
- Customizable date ranges
- KPI cards with trend indicators
- Multiple chart types

**Usage Example:**
```tsx
import { ComprehensiveMetricsDashboard } from '@/components/ComprehensiveMetricsDashboard';

<ComprehensiveMetricsDashboard />
```

**Required Context:** facility_id

## Error Handling

All components include built-in error handling:

```typescript
// Components display error alerts automatically
const [error, setError] = useState<string | null>(null);

// Errors are caught and displayed in UI
try {
  const data = await dbService.someOperation();
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to load data');
}

// UI shows error banner
{error && (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-800">{error}</p>
  </div>
)}
```

## Styling

All components use Tailwind CSS v4 with PostCSS. Ensure you have:

```json
{
  "dependencies": {
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.0"
  }
}
```

And your `postcss.config.js` is set up:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

## Performance Optimization

### Code Splitting
Components are designed to be lazy-loadable:

```typescript
const StoreProductManager = React.lazy(() => 
  import('@/components/StoreProductManager').then(m => ({ default: m.StoreProductManager }))
);
```

### Pagination
For large datasets, implement pagination:

```typescript
const [page, setPage] = useState(1);
const pageSize = 20;

const paginatedData = data.slice((page - 1) * pageSize, page * pageSize);
```

### Query Optimization
Database queries use indexes on common fields:
- facility_id (all tables)
- user_id (notifications, channels)
- created_at (all tables)
- is_active/is_published (filtering)

## Security Considerations

### RLS Policies
All tables are protected with RLS:
- Multi-tenant isolation via facility_id
- Role-based access (admin, super_admin_dev)
- User-specific access where applicable

### Input Validation
All user inputs are validated:
- Length constraints
- Type checking
- Required field validation

### Audit Logging
All modifications are logged:
- User ID
- Action (INSERT, UPDATE, DELETE)
- Timestamp
- Before/after data

## Troubleshooting

### Issue: "Unable to reach Supabase"
**Solution:** Check your `src/services/supabase.ts` connection string and ensure Supabase project is running.

### Issue: "RLS policy denies access"
**Solution:** 
1. Verify user role in `profiles` table
2. Check facility_id matches
3. Review RLS policies in Supabase dashboard

### Issue: "Components not rendering"
**Solution:**
1. Check AppContext provider is wrapping the app
2. Verify user is authenticated
3. Check browser console for errors

### Issue: "Data not updating in real-time"
**Solution:**
1. Verify Supabase real-time is enabled
2. Check channel subscriptions are active
3. Review WebSocket connection in browser dev tools

## Next Steps

1. **Apply the migration** - `supabase db push`
2. **Integrate components** into your dashboards
3. **Test CRUD operations** in your browser
4. **Implement real-time subscriptions** (optional)
5. **Add error logging** for production
6. **Set up monitoring** for metrics
7. **Configure notifications** backend (Sendgrid, Twilio, etc.)

## Support & Documentation

For detailed API documentation, see:
- Type definitions: `src/types/index.ts`
- Database service: `src/services/database.ts`
- Migration file: `supabase/migrations/047_store_notifications_news_channels.sql`

For component documentation, see JSDoc comments in each component file.
