-- =====================================================
-- REFINE STORE ORDERS & ROLES
-- Adds delivery fields, updates status check, and expands roles
-- =====================================================

-- 0. Expand User Roles Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'user_role' AND enumlabel = 'prescriber') THEN
        ALTER TYPE user_role ADD VALUE 'prescriber';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'user_role' AND enumlabel = 'rider') THEN
        ALTER TYPE user_role ADD VALUE 'rider';
    END IF;
END $$;

-- 1. Update status check constraint if it exists
DO $$ 
BEGIN
    ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_status_check;
END $$;

ALTER TABLE store_orders 
ADD CONSTRAINT store_orders_status_check 
CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED'));

-- 2. Add delivery and assignment fields to store_orders if they don't exist
ALTER TABLE store_orders 
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS expected_delivery_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_delivery_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_store_orders_assigned ON store_orders(assigned_to);

-- 3. Update existing statuses to uppercase if any was lowercase
UPDATE store_orders SET status = UPPER(status);

-- 4. Enable RLS and add policies just in case
ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_orders' AND policyname = 'Facility staff can manage store orders') THEN
        CREATE POLICY "Facility staff can manage store orders"
            ON store_orders FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND (facility_id = store_orders.facility_id OR role IN ('super_admin_bms', 'super_admin_dev'))
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_orders' AND policyname = 'Users can view own store orders') THEN
        CREATE POLICY "Users can view own store orders"
            ON store_orders FOR SELECT
            USING (customer_id = auth.uid());
    END IF;
END $$;
