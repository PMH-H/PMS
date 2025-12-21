-- Create table for storing Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, user_agent) -- Prevent duplicate subs for same browser? Or maybe just user_id for simplicity
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own subscriptions"
    ON push_subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions"
    ON push_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
    ON push_subscriptions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service Role (Edge Functions) needs to read all to send notifications
CREATE POLICY "Service role can read all subscriptions"
    ON push_subscriptions
    FOR SELECT
    TO service_role
    USING (true);

-- Upsert function to handle "Update if exists" logic easily from frontend
CREATE OR REPLACE FUNCTION upsert_push_subscription(
    p_subscription JSONB,
    p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_sub_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    INSERT INTO push_subscriptions (user_id, subscription, user_agent)
    VALUES (v_user_id, p_subscription, p_user_agent)
    ON CONFLICT (user_id, user_agent)
    DO UPDATE SET 
        subscription = p_subscription,
        updated_at = NOW()
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('id', v_sub_id, 'status', 'upserted');
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_push_subscription(JSONB, TEXT) TO authenticated;
