-- =====================================================
-- 048: Role-Based Signup & Delivery System
-- =====================================================
-- This migration adds:
-- 1. signup_requests table for role-based registration
-- 2. riders table for delivery personnel
-- 3. deliveries table for tracking
-- 4. payment_transactions table for mobile money
-- NOTE: store_products and store_orders are in migration 047

-- =====================================================
-- SIGNUP REQUESTS (Role-Based Registration)
-- =====================================================
CREATE TABLE IF NOT EXISTS signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id), -- Linked after Supabase auth signup
    requested_role TEXT NOT NULL CHECK (requested_role IN ('patient', 'prescriber', 'pharmacist_admin')),
    full_name TEXT NOT NULL,
    phone TEXT,
    -- Professional verification fields
    hpcz_number TEXT, -- Health Professions Council of Zambia number
    license_document_url TEXT, -- Uploaded license/certificate
    specialization TEXT, -- For prescribers: e.g., "General Practitioner", "Pediatrician"
    facility_name TEXT, -- For pharmacist_admin: their pharmacy name
    facility_address TEXT,
    -- Verification status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'hpcz_verified', 'admin_review', 'approved', 'rejected')),
    hpcz_verification_response JSONB, -- Store API response
    hpcz_verified_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_signup_requests_email ON signup_requests(email);
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_hpcz ON signup_requests(hpcz_number);

-- =====================================================
-- RIDERS (Delivery Personnel)
-- =====================================================
CREATE TABLE IF NOT EXISTS riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id), -- Link to user profile if they have account
    facility_id UUID REFERENCES facilities(id), -- Home base pharmacy
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    vehicle_type TEXT CHECK (vehicle_type IN ('motorcycle', 'bicycle', 'car', 'walking')),
    vehicle_registration TEXT,
    license_number TEXT,
    profile_photo_url TEXT,
    -- Availability
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    current_location JSONB, -- {lat, lng, updated_at}
    -- Performance
    total_deliveries INT DEFAULT 0,
    average_rating NUMERIC(3,2) DEFAULT 5.0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riders_facility ON riders(facility_id);
CREATE INDEX IF NOT EXISTS idx_riders_available ON riders(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_riders_user ON riders(user_id);

-- =====================================================
-- DELIVERIES (Links to store_orders from migration 047)
-- =====================================================
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES store_orders(id) NOT NULL, -- Reference store_orders from 047
    rider_id UUID REFERENCES riders(id),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'assigned', 'rider_accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'
    )),
    -- Assignment
    assigned_at TIMESTAMPTZ,
    rider_accepted_at TIMESTAMPTZ,
    -- Tracking
    pickup_location JSONB, -- {lat, lng, address}
    delivery_location JSONB, -- {lat, lng, address}
    current_location JSONB, -- Real-time rider location
    distance_km NUMERIC(6,2),
    estimated_time_minutes INT,
    -- Completion
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    proof_of_delivery_url TEXT, -- Photo of delivered package
    recipient_name TEXT,
    recipient_signature_url TEXT,
    -- Issues
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    delivery_attempts INT DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider ON deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- =====================================================
-- PAYMENT TRANSACTIONS (Mobile Money)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES store_orders(id), -- Reference store_orders from 047
    user_id UUID REFERENCES profiles(id),
    provider TEXT NOT NULL CHECK (provider IN ('mtn_momo', 'airtel_money', 'cash')),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'refund')),
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'ZMW',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled')),
    -- Provider details
    provider_reference TEXT, -- Transaction ID from MTN/Airtel
    phone_number TEXT, -- Customer phone for mobile money
    -- Response
    provider_response JSONB,
    failure_reason TEXT,
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Signup Requests: Users can only see their own
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signup request"
    ON signup_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create signup request"
    ON signup_requests FOR INSERT
    WITH CHECK (true); -- Anyone can sign up

CREATE POLICY "Admins can view all signup requests"
    ON signup_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin_bms', 'super_admin_dev', 'admin')
        )
    );

CREATE POLICY "Admins can update signup requests"
    ON signup_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin_bms', 'super_admin_dev', 'admin')
        )
    );

-- Riders: Facility staff can manage, riders can see own
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can view own profile"
    ON riders FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Riders can update own profile"
    ON riders FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Facility staff can manage riders"
    ON riders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (facility_id = riders.facility_id OR role IN ('super_admin_bms', 'super_admin_dev', 'admin'))
        )
    );

-- Deliveries: Riders see assigned, facility sees all
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can view assigned deliveries"
    ON deliveries FOR SELECT
    USING (
        rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid())
    );

CREATE POLICY "Riders can update assigned deliveries"
    ON deliveries FOR UPDATE
    USING (
        rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid())
    );

CREATE POLICY "Facility staff can manage deliveries"
    ON deliveries FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM store_orders o
            JOIN profiles p ON p.id = auth.uid()
            WHERE o.id = deliveries.order_id 
            AND (p.facility_id = o.facility_id OR p.role IN ('super_admin_bms', 'super_admin_dev'))
        )
    );

-- Payment Transactions: Users see own, admins see all
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
    ON payment_transactions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all transactions"
    ON payment_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin_bms', 'super_admin_dev', 'admin', 'pharmacist')
        )
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to auto-approve patients (no HPCZ required)
CREATE OR REPLACE FUNCTION auto_approve_patient_signup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.requested_role = 'patient' THEN
        NEW.status := 'approved';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_approve_patient ON signup_requests;
CREATE TRIGGER trigger_auto_approve_patient
    BEFORE INSERT ON signup_requests
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_patient_signup();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_signup_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_signup_timestamp ON signup_requests;
CREATE TRIGGER trigger_update_signup_timestamp
    BEFORE UPDATE ON signup_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_signup_timestamp();

COMMENT ON TABLE signup_requests IS 'Stores role-based signup requests with HPCZ verification support';
COMMENT ON TABLE riders IS 'Delivery personnel linked to facilities';
COMMENT ON TABLE deliveries IS 'Delivery tracking for store orders';
COMMENT ON TABLE payment_transactions IS 'Mobile money and payment records';
