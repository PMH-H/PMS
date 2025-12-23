SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'audit%';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_log';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs';
