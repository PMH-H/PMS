-- Create and drop a dummy table to force schema cache reload
CREATE TABLE IF NOT EXISTS force_schema_cache_reload (id serial primary key);
NOTIFY pgrst, 'reload schema';
DROP TABLE force_schema_cache_reload;
