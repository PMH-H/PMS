SELECT to_regclass('public.alerts');
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'alerts';
