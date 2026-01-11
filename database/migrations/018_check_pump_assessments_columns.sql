-- Check what columns actually exist in pump_assessments table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_assessments'
ORDER BY ordinal_position;
