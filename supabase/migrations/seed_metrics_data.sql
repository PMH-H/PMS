-- Seed Auth Events (Last 24 hours)
INSERT INTO public.auth_events (user_id, event_type, success, ip_address, created_at)
SELECT 
    id as user_id,
    'login_success',
    true,
    '192.168.1.' || floor(random() * 255)::text,
    NOW() - (random() * interval '24 hours')
FROM public.profiles
WHERE role IN ('pharmacist', 'admin')
LIMIT 15;

-- Seed Failed Logins
INSERT INTO public.auth_events (user_id, event_type, success, failure_reason, ip_address, created_at)
SELECT 
    id as user_id,
    'login_failed',
    false,
    'Invalid password',
    '10.0.0.' || floor(random() * 255)::text,
    NOW() - (random() * interval '12 hours')
FROM public.profiles
LIMIT 5;

-- Seed Security Events
INSERT INTO public.security_events (user_id, event_type, severity, description, ip_address, resolved, created_at)
SELECT 
    id as user_id,
    'suspicious_login_location',
    'medium',
    'Login attempt from unusual location (Lusaka, ZM)',
    '45.2.1.' || floor(random() * 255)::text,
    false,
    NOW() - (random() * interval '48 hours')
FROM public.profiles
WHERE role = 'admin'
LIMIT 1;

INSERT INTO public.security_events (user_id, event_type, severity, description, ip_address, resolved, created_at)
VALUES 
    (NULL, 'multiple_failed_logins', 'high', '5 failed login attempts from same IP', '203.0.113.45', false, NOW() - interval '2 hours');
