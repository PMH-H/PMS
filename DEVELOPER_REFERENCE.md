# Developer Quick Reference

## New Files Created

```
src/
├── components/
│   ├── StoreProductManager.tsx       (450 lines) - Product CRUD
│   ├── HealthNewsWidget.tsx          (450 lines) - Health articles
│   ├── UserChannelsWidget.tsx        (550 lines) - Community channels
│   ├── NotificationManager.tsx       (500 lines) - Notifications
│   └── ComprehensiveMetricsDashboard.tsx (400 lines) - Analytics
├── services/
│   └── database.ts                   (UPDATED: +350 lines) - 40+ new functions
└── types/
    └── index.ts                      (UPDATED: +100 lines) - 15+ new types

supabase/
└── migrations/
    └── 047_store_notifications_news_channels.sql (650 lines)
        ├── 12 new tables
        ├── 20+ RLS policies
        └── 5 audit triggers

Documentation/
├── IMPLEMENTATION_SUMMARY.md         - Detailed implementation record
└── INTEGRATION_GUIDE.md              - How to integrate features
```

## Type System

### Core Types

```typescript
// Product Management
interface StoreProduct {
  id: UUID;
  facility_id: UUID;
  name: string;
  category: ProductCategory;
  sku: string;
  price_cents: number;
  stock_quantity: number;
  reorder_level: number;
  image_url?: string;
  tags?: string[];
  created_at: ISOString;
  is_active: boolean;
}

// Notifications
interface UserNotification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: ISOString;
  created_at: ISOString;
}

// Channels
interface UserChannel {
  id: UUID;
  creator_id: UUID;
  facility_id: UUID;
  name: string;
  type: ChannelType;
  member_count: number;
  is_active: boolean;
  created_at: ISOString;
}

// Health Content
interface HealthArticle {
  id: UUID;
  facility_id: UUID;
  author_id: UUID;
  title: string;
  content: string;
  category: ArticleCategory;
  is_published: boolean;
  view_count: number;
  created_at: ISOString;
}
```

### Enums

```typescript
enum ProductCategory {
  OTC_MEDICINES = 'OTC_MEDICINES',
  COSMETICS = 'COSMETICS',
  SUPPLEMENTS = 'SUPPLEMENTS',
  PERSONAL_CARE = 'PERSONAL_CARE',
  WELLNESS = 'WELLNESS',
  FIRST_AID = 'FIRST_AID'
}

enum NotificationType {
  ORDER_UPDATE = 'ORDER_UPDATE',
  HEALTH_ALERT = 'HEALTH_ALERT',
  NEWS = 'NEWS',
  CHANNEL_MESSAGE = 'CHANNEL_MESSAGE',
  PROMOTION = 'PROMOTION',
  PRESCRIPTION_READY = 'PRESCRIPTION_READY'
}

enum ChannelType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  COMMUNITY = 'COMMUNITY'
}
```

## Database Service Functions

### Store Products

```typescript
// List with filtering
const products = await dbService.getStoreProducts(facilityId, {
  category: 'OTC_MEDICINES',
  searchTerm: 'aspirin'
});

// CRUD
const product = await dbService.createStoreProduct({ ...product, facility_id });
const updated = await dbService.updateStoreProduct(productId, { price_cents: 500 });
await dbService.deleteStoreProduct(productId); // Soft delete
```

### Notifications

```typescript
// Get with filtering
const unread = await dbService.getUserNotifications(userId, true);

// Create
await dbService.createNotification({
  user_id: userId,
  type: 'ORDER_UPDATE',
  title: 'Order Ready',
  message: 'Your order is ready for pickup'
});

// Mark as read
await dbService.markNotificationAsRead(notificationId);

// Preferences
const prefs = await dbService.getNotificationPreferences(userId);
await dbService.updateNotificationPreferences(userId, {
  email_notifications: true,
  promotions: false
});
```

### Channels

```typescript
// List channels
const channels = await dbService.getUserChannels(facilityId);

// Create
const channel = await dbService.createUserChannel({
  name: 'Health Tips',
  type: 'PUBLIC',
  creator_id: userId,
  facility_id: facilityId
});

// Membership
await dbService.addChannelMember(channelId, userId, 'MEMBER');
await dbService.removeChannelMember(channelId, userId);

// Messages
const messages = await dbService.getChannelMessages(channelId);
await dbService.sendChannelMessage(channelId, 'Hello everyone!');
```

### Health Articles

```typescript
// List
const articles = await dbService.getHealthArticles(facilityId, true); // published only

// CRUD
const article = await dbService.createHealthArticle({
  title: 'Diabetes Management',
  content: '...',
  category: 'DISEASE',
  facility_id: facilityId,
  author_id: userId
});

await dbService.updateHealthArticle(articleId, { is_published: true });
await dbService.deleteHealthArticle(articleId);
```

### Metrics

```typescript
// Get analytics
const storeMetrics = await dbService.getStoreMetrics(facilityId, {
  from: '2024-01-01',
  to: '2024-01-31'
});

const systemMetrics = await dbService.getSystemMetrics(facilityId, {
  from: '2024-01-01',
  to: '2024-01-31'
});
```

## Component Usage

### StoreProductManager

```tsx
import { StoreProductManager } from '@/components/StoreProductManager';

export const AdminPage = () => {
  return <StoreProductManager />;
};
```

**Features:**
- Product CRUD with form validation
- Category and search filtering
- Stock alerts
- Price and inventory tracking
- Tag management
- Summary statistics

**Required Context:** 
- `facility.id` - Facility UUID
- `user.id` - Current user UUID

### HealthNewsWidget

```tsx
import { HealthNewsWidget } from '@/components/HealthNewsWidget';

export const NewsPage = () => {
  return <HealthNewsWidget />;
};
```

**Features:**
- Article editor with markdown
- Publish/draft workflow
- Category filtering
- Tag management
- View count tracking
- Author attribution

**Required Context:**
- `facility.id` - Facility UUID
- `user.id`, `user.role` - User info

### UserChannelsWidget

```tsx
import { UserChannelsWidget } from '@/components/UserChannelsWidget';

export const CommunityPage = () => {
  return <UserChannelsWidget />;
};
```

**Features:**
- Create public/private/community channels
- Real-time messaging
- Member management
- Broadcasting to channel
- Channel search
- Join/leave functionality

**Required Context:**
- `facility.id` - Facility UUID
- `user.id` - Current user UUID

### NotificationManager

```tsx
import { NotificationManager } from '@/components/NotificationManager';

export const NotificationsPage = () => {
  return <NotificationManager />;
};
```

**Features:**
- Notification inbox with filtering
- Mark as read/unread
- Delete notifications
- Preference management
- Delivery method selection
- Notification statistics

**Required Context:**
- `user.id` - Current user UUID

### ComprehensiveMetricsDashboard

```tsx
import { ComprehensiveMetricsDashboard } from '@/components/ComprehensiveMetricsDashboard';

export const AnalyticsPage = () => {
  return <ComprehensiveMetricsDashboard />;
};
```

**Features:**
- KPI cards (Revenue, Orders, Avg Order Value, Active Users)
- Revenue trend (line chart)
- Orders trend (bar chart)
- Category distribution (pie chart)
- System health monitoring
- Date range filtering
- Trend analysis

**Required Context:**
- `facility.id` - Facility UUID

## Database Schema

### Tables

```
store_products
├── id (UUID PK)
├── facility_id (UUID FK)
├── name (VARCHAR)
├── category (ENUM)
├── price_cents (INT)
├── stock_quantity (INT)
└── ... (16 fields total)

user_channels
├── id (UUID PK)
├── facility_id (UUID FK)
├── creator_id (UUID FK)
├── name (VARCHAR)
├── type (ENUM)
└── ... (10 fields total)

channel_memberships
├── channel_id (UUID FK)
├── user_id (UUID FK)
├── role (ENUM: ADMIN, MODERATOR, MEMBER)
└── joined_at (TIMESTAMPTZ)

user_notifications
├── id (UUID PK)
├── user_id (UUID FK)
├── type (ENUM)
├── title (VARCHAR)
├── message (TEXT)
└── ... (8 fields total)

health_articles
├── id (UUID PK)
├── facility_id (UUID FK)
├── author_id (UUID FK)
├── title (VARCHAR)
├── content (TEXT)
├── category (ENUM)
└── ... (12 fields total)

broadcasts
├── id (UUID PK)
├── channel_id (UUID FK)
├── sender_id (UUID FK)
├── title (VARCHAR)
├── content (TEXT)
├── delivery_status (ENUM)
└── ... (10 fields total)

store_metrics
├── date (DATE)
├── facility_id (UUID FK)
├── total_orders (INT)
├── total_revenue_cents (INT)
└── ... (6 fields total)
```

## RLS Policies

All tables protected with policies:

```sql
-- Example: store_products
-- Admins see all, users see active only
CREATE POLICY "store_products_view" ON store_products FOR SELECT
  USING (is_active = true OR auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() 
      AND p.facility_id = store_products.facility_id 
      AND p.role IN ('admin', 'super_admin_dev')));
```

## Performance Tips

### Query Optimization
1. Use facility_id filter to reduce dataset
2. Implement pagination for large lists
3. Use date range filters in metrics
4. Cache frequently accessed data

### Component Optimization
1. Use React.memo for list items
2. Implement virtual scrolling for long lists
3. Lazy load modals and expanded views
4. Debounce search inputs

### Database Tips
1. Indexes on facility_id, user_id, created_at
2. Soft deletes with is_active filter
3. Partition metrics tables by date
4. Archive old data regularly

## Common Patterns

### Loading State

```typescript
const [loading, setLoading] = useState(false);

const loadData = async () => {
  try {
    setLoading(true);
    const data = await dbService.getData();
    setData(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

// In JSX
{loading ? <Spinner /> : <DataDisplay />}
```

### Error Handling

```typescript
const [error, setError] = useState<string | null>(null);

try {
  await operation();
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}

// In JSX
{error && <ErrorAlert message={error} />}
```

### Form Submission

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) return;
  
  try {
    setLoading(true);
    await dbService.create(formData);
    resetForm();
    setSuccess(true);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

## Testing Checklist

- [ ] Can create product and see in list
- [ ] Can edit product and see changes
- [ ] Can delete product (soft delete)
- [ ] Stock alerts display correctly
- [ ] Categories filter works
- [ ] Search functionality works
- [ ] RLS prevents unauthorized access
- [ ] Audit logs record changes
- [ ] Real-time updates work (optional)
- [ ] Notifications are created
- [ ] Channels can be created and joined
- [ ] Messages persist and display
- [ ] Metrics calculate correctly
- [ ] Date range filtering works

## Deployment Checklist

- [ ] Run `supabase db push` to apply migrations
- [ ] Verify RLS policies in Supabase dashboard
- [ ] Test all CRUD operations in production
- [ ] Set up monitoring for metrics
- [ ] Configure notification delivery (email, SMS)
- [ ] Back up database
- [ ] Document API endpoints
- [ ] Update user documentation
- [ ] Train support team
- [ ] Monitor error logs
- [ ] Set up alerts for failures

## Useful Links

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Recharts Documentation](https://recharts.org)
