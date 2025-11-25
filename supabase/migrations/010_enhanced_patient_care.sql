-- 1. Enhance Items Table (Images & Price)
ALTER TABLE items ADD COLUMN IF NOT EXISTS front_image_url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS back_image_url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0;

-- 2. Create Health News Table
CREATE TABLE IF NOT EXISTS health_news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Messages Table (In-app messaging)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  receiver_id UUID REFERENCES auth.users(id), -- Can be null if sending to a facility generally
  facility_id UUID REFERENCES facilities(id), -- Target facility
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on new tables
ALTER TABLE health_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Health News: Public read, Admin write
CREATE POLICY "Public can read health news" ON health_news
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage health news" ON health_news
  FOR ALL USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role IN ('SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
  )
);

-- Messages: Users can see messages they sent or received, or messages for their facility
CREATE POLICY "Users can read their own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    (facility_id IS NOT NULL AND exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.facility_id = messages.facility_id
    ))
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

CREATE POLICY "Users can update (mark read) messages they received" ON messages
  FOR UPDATE USING (
    auth.uid() = receiver_id OR
    (facility_id IS NOT NULL AND exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.facility_id = messages.facility_id
    ))
  );

-- Items: Allow image updates for admins
-- (Existing policies might cover this, but ensuring specific column access if needed)
-- Assuming existing "Admins can update items" policy covers these new columns.

-- 6. Storage Bucket for Product Images
-- Note: Buckets are usually created via API/Dashboard, but we can define policies here if the bucket exists.
-- We'll assume a 'product-images' bucket will be created.

-- Policy for product-images bucket (if using storage.objects)
-- insert into storage.buckets (id, name) values ('product-images', 'product-images') on conflict do nothing;

-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'product-images' );
-- create policy "Admin Upload" on storage.objects for insert with check ( bucket_id = 'product-images' and exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')) );
