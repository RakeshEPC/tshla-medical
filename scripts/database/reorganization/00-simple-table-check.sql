-- =====================================================
-- Simple Table Check - See what tables exist
-- =====================================================

-- First, let's see what tables you actually have
SELECT
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Now check row counts only for tables that exist
SELECT
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
