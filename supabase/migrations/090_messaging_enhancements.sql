
-- Migration: 090_messaging_enhancements.sql
-- Description: Adds media support to messages and creates thread retrieval RPC

-- 1. Add Media Support
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('IMAGE', 'AUDIO', 'VIDEO', 'FILE'));

-- 2. Audit Function for Messages (if not exists)
CREATE OR REPLACE FUNCTION log_message_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit.audit_logs (table_name, record_id, action, new_data, previous_data, performed_by)
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    row_to_json(NEW),
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger first to avoid duplication error if re-running
DROP TRIGGER IF EXISTS audit_messages_trigger ON public.messages;

-- Create Trigger
CREATE TRIGGER audit_messages_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION log_message_audit();


-- 3. RPC: Get Conversations (Thread View)
-- Returns a list of users the current user has chatted with, plus the latest message
CREATE OR REPLACE FUNCTION public.get_conversations(p_user_id UUID)
RETURNS TABLE (
    partner_id UUID,
    partner_name TEXT,
    partner_role TEXT,
    partner_avatar TEXT,
    last_message_content TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH diff_partners AS (
        -- Find all unique partners
        SELECT DISTINCT
            CASE WHEN sender_id = p_user_id THEN recipient_id ELSE sender_id END AS partner_id
        FROM public.messages
        WHERE sender_id = p_user_id OR recipient_id = p_user_id
    ),
    latest_msg AS (
        -- Get latest message per partner
        SELECT 
            m.id,
            m.content, 
            m.created_at,
            CASE WHEN m.sender_id = p_user_id THEN m.recipient_id ELSE m.sender_id END AS partner_id,
            ROW_NUMBER() OVER (PARTITION BY (CASE WHEN m.sender_id = p_user_id THEN m.recipient_id ELSE m.sender_id END) ORDER BY m.created_at DESC) as rn
        FROM public.messages m
        WHERE m.sender_id = p_user_id OR m.recipient_id = p_user_id
    ),
    unread AS (
        -- Count unread messages from partner
        SELECT 
            sender_id as partner_id,
            COUNT(*) as count
        FROM public.messages
        WHERE recipient_id = p_user_id AND is_read = FALSE
        GROUP BY sender_id
    )
    SELECT 
        dp.partner_id,
        p.full_name as partner_name,
        p.role::text as partner_role,
        p.avatar_url as partner_avatar,
        lm.content as last_message_content,
        lm.created_at as last_message_at,
        COALESCE(u.count, 0) as unread_count
    FROM diff_partners dp
    JOIN public.profiles p ON p.id = dp.partner_id
    JOIN latest_msg lm ON lm.partner_id = dp.partner_id AND lm.rn = 1
    LEFT JOIN unread u ON u.partner_id = dp.partner_id
    ORDER BY lm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Get Available Pharmacists (For Patients to start new chat)
CREATE OR REPLACE FUNCTION public.get_available_pharmacists()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    facility_name TEXT,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        f.name as facility_name,
        p.avatar_url
    FROM public.profiles p
    LEFT JOIN public.facilities f ON p.facility_id = f.id
    WHERE p.role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
