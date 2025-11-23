-- Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    image_url TEXT,
    medications JSONB DEFAULT '[]'::jsonb,
    interactions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Policies

-- Patients can view their own prescriptions
CREATE POLICY "Patients can view own prescriptions" ON prescriptions
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Patients can create their own prescriptions
CREATE POLICY "Patients can create own prescriptions" ON prescriptions
    FOR INSERT
    WITH CHECK (auth.uid() = patient_id);

-- Pharmacists and Admins can view all prescriptions
CREATE POLICY "Staff can view all prescriptions" ON prescriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- Pharmacists and Admins can update prescriptions
CREATE POLICY "Staff can update prescriptions" ON prescriptions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );
