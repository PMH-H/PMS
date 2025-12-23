# PharmAI Supabase Backend - Setup Guide

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Supabase CLI** (optional but recommended):
   ```bash
   npm install -g supabase
   ```

## Step 1: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: PharmAI
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## Step 2: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Configure Environment Variables

Create or update `.env.local` in your project root:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
GEMINI_API_KEY=your-gemini-api-key-here
```

## Step 4: Run Database Migrations

### Option A: Using Supabase Dashboard (Easiest)

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Repeat for `002_rls_policies.sql`

### Option B: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

## Step 5: Deploy Edge Functions

### Option A: Using Supabase Dashboard

1. Go to **Edge Functions** in your dashboard
2. Click **Create Function**
3. For each function (`reorder-calculator`, `demand-forecast`, `stock-health-analyzer`):
   - Name: (function name)
   - Copy code from `supabase/functions/{function-name}/index.ts`
   - Deploy

### Option B: Using Supabase CLI

```bash
# Deploy all functions
supabase functions deploy reorder-calculator
supabase functions deploy demand-forecast
supabase functions deploy stock-health-analyzer
```

## Step 6: Set Edge Function Secrets

Your Edge Functions need the Gemini API key:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
```

Or in the dashboard: **Edge Functions** → **Settings** → **Secrets**

## Step 7: Create Storage Buckets

Go to **Storage** in your Supabase dashboard and create these buckets:

1. **supplier-invoices** (Private)
2. **product-images** (Public)
3. **stock-cards** (Private)

### Storage Policies

For each bucket, add these policies:

#### supplier-invoices
```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'supplier-invoices');

-- Allow facility staff to read their invoices
CREATE POLICY "Staff can read facility invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'supplier-invoices' AND is_staff());
```

#### product-images
```sql
-- Public read access
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Staff can upload
CREATE POLICY "Staff can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND is_staff());
```

## Step 8: Seed Initial Data

Run this SQL to create initial test data:

```sql
-- Create a test facility
INSERT INTO facilities (id, name, type, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Main Pharmacy', 'PHARMACY', true);

-- Create a test supplier
INSERT INTO suppliers (id, name, lead_time_days, reliability_score)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'MedSupply Co.', 7, 0.95);

-- Note: User profiles will be created automatically when users sign up
```

## Step 9: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your browser and check the console for:
   ```
   Supabase Connected Successfully
   ```

3. Test database connection:
   ```typescript
   import { supabase } from './services/supabase';
   
   const testConnection = async () => {
     const { data, error } = await supabase.from('items').select('count');
     console.log('Connection test:', error ? 'Failed' : 'Success');
   };
   ```

## Step 10: Create Your First User

### Using Supabase Auth UI

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add User**
3. Enter email and password
4. After creating, run this SQL to set their role:

```sql
-- Insert profile for the user
INSERT INTO profiles (id, role, facility_id, full_name)
VALUES 
  ('user-id-from-auth-users', 'ADMIN', '00000000-0000-0000-0000-000000000001', 'Admin User');
```

## Verification Checklist

- [ ] Database migrations ran successfully
- [ ] RLS policies are enabled (check table settings)
- [ ] Edge Functions are deployed and accessible
- [ ] Storage buckets are created
- [ ] Environment variables are set
- [ ] Test user can log in
- [ ] Real-time subscriptions work (check browser console)

## Troubleshooting

### "relation does not exist" error
- Make sure you ran both migration files in order
- Check SQL Editor for any errors

### RLS policy errors
- Verify user has a profile in the `profiles` table
- Check that `facility_id` is set correctly

### Edge Functions not working
- Verify secrets are set (`GEMINI_API_KEY`)
- Check function logs in Supabase dashboard
- Ensure CORS headers are correct

### Real-time not updating
- Check browser console for subscription errors
- Verify Realtime is enabled in project settings
- Ensure RLS policies allow SELECT on tables

## Next Steps

1. **Customize roles**: Adjust RLS policies for your specific needs
2. **Add more Edge Functions**: Vendor performance, anomaly detection
3. **Set up automated backups**: Configure in Supabase project settings
4. **Enable 2FA**: For admin users in production
5. **Monitor usage**: Set up alerts in Supabase dashboard

## Support

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Discord**: [discord.supabase.com](https://discord.supabase.com)
- **GitHub Issues**: For PharmAI-specific issues

---

**🎉 Your PharmAI backend is now ready!**
