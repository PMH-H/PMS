CREATE TABLE IF NOT EXISTS facility_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, facility_id) -- One request per user per facility
);

-- Enable RLS
ALTER TABLE facility_join_requests ENABLE ROW LEVEL SECURITY;

-- Policies for join requests
-- Users can see their own requests
CREATE POLICY "Users can view own requests" ON facility_join_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create requests (if they don't have a facility)
CREATE POLICY "Users can create requests" ON facility_join_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view requests for their facility
CREATE POLICY "Admins can view facility requests" ON facility_join_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND facility_id = facility_join_requests.facility_id
        )
    );

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update facility requests" ON facility_join_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND facility_id = facility_join_requests.facility_id
        )
    );

-- RPC to approve a request
CREATE OR REPLACE FUNCTION approve_join_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_facility_id UUID;
    v_admin_facility UUID;
BEGIN
    -- Get request details
    SELECT user_id, facility_id INTO v_user_id, v_facility_id
    FROM facility_join_requests
    WHERE id = p_request_id AND status = 'PENDING';

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    -- Verify caller is admin of this facility
    SELECT facility_id INTO v_admin_facility
    FROM profiles
    WHERE id = auth.uid() AND role = 'admin';

    IF v_admin_facility IS NULL OR v_admin_facility != v_facility_id THEN
        RAISE EXCEPTION 'Not authorized to approve requests for this facility.';
    END IF;

    -- Update request status
    UPDATE facility_join_requests
    SET status = 'APPROVED', updated_at = NOW()
    WHERE id = p_request_id;

    -- Update user profile
    UPDATE profiles
    SET facility_id = v_facility_id, updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Request approved and user linked.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON facility_join_requests TO authenticated;
GRANT EXECUTE ON FUNCTION approve_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_join_request(UUID) TO service_role;
