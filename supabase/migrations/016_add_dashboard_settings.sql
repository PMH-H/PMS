-- Migration: 016_add_dashboard_settings.sql
-- Description: Adds the dashboard_settings table for user-specific preferences.
-- =====================================================

-- 1. Create the dashboard_settings table
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add RLS policies for the dashboard_settings table
-- =====================================================
ALTER TABLE dashboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dashboard settings"
ON dashboard_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard settings"
ON dashboard_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard settings"
ON dashboard_settings FOR UPDATE
USING (auth.uid() = user_id);
