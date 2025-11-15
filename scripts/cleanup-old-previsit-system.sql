-- Cleanup Old Pre-Visit System
-- Removes unused previsit_responses table and related objects
-- Keeps previsit_call_data as the single source of truth

-- Drop old unused tables
DROP TABLE IF EXISTS public.previsit_responses CASCADE;
DROP TABLE IF EXISTS public.previsit_call_log CASCADE;

-- Verify we kept the correct table
-- This should show the previsit_call_data table with data
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'previsit_call_data') as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'previsit_call_data';

-- Show record count in the table we're keeping
SELECT COUNT(*) as total_records FROM public.previsit_call_data;

-- Show sample of data to confirm it's the right table
SELECT
  id,
  conversation_id,
  phone_number,
  created_at,
  COALESCE(array_length(medications, 1), 0) as med_count,
  COALESCE(array_length(concerns, 1), 0) as concern_count,
  COALESCE(array_length(questions, 1), 0) as question_count
FROM public.previsit_call_data
ORDER BY created_at DESC
LIMIT 5;
