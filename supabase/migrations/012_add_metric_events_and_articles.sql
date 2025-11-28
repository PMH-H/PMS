-- Migration: 012_add_metric_events_and_articles.sql
-- Description: Creates the metric_events and articles tables for analytics and content.
-- =====================================================

-- 1. Create metric_events table
-- =====================================================
CREATE TABLE IF NOT EXISTS metric_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    payload JSONB,
    user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_metric_events_name ON metric_events(name);
CREATE INDEX IF NOT EXISTS idx_metric_events_user_id ON metric_events(user_id);
CREATE INDEX IF NOT EXISTS idx_metric_events_created_at ON metric_events(created_at DESC);

-- RLS for metric_events
ALTER TABLE metric_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all metric events"
ON metric_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
);

CREATE POLICY "Users can insert their own metric events"
ON metric_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2. Create articles table
-- =====================================================
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    image_url TEXT,
    created_at TIMESTAMTz DEFAULT NOW()
);

-- RLS for articles
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view articles"
ON articles FOR SELECT
USING (true);

CREATE POLICY "Admins can create articles"
ON articles FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
);

-- Seed some initial articles
INSERT INTO articles (title, content, author)
VALUES
    ('Understanding Your Prescription', 'A guide to reading and understanding your prescription.', 'Dr. Emily Carter'),
    ('The Importance of Medication Adherence', 'Why it is crucial to take your medication as prescribed.', 'Dr. John Smith');
