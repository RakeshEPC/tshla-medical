-- Fix Row Level Security (RLS) Policies for previsit_call_data
-- Issue: Table has RLS enabled but no policies, so anonymous users can't read data
-- This prevents the frontend from displaying pre-visit call data

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous read access to previsit_call_data" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow service role full access to previsit_call_data" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow public read access" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow public insert" ON public.previsit_call_data;
DROP POLICY IF EXISTS "Allow public update" ON public.previsit_call_data;

-- Create policy to allow anonymous users to read all previsit call data
-- This is safe because:
-- 1. Data is already redacted (HIPAA-compliant with Zero Retention Mode)
-- 2. Only structured data (medications list, concerns, questions) is stored
-- 3. Frontend needs to display this data to staff
CREATE POLICY "Allow public read access"
  ON public.previsit_call_data
  FOR SELECT
  TO public
  USING (true);

-- Allow anonymous users to insert new records (for webhook capture)
CREATE POLICY "Allow public insert"
  ON public.previsit_call_data
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anonymous users to update existing records (for appending data during call)
CREATE POLICY "Allow public update"
  ON public.previsit_call_data
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE public.previsit_call_data ENABLE ROW LEVEL SECURITY;

-- Test query (run this after applying policies to verify)
-- SELECT COUNT(*) as total_visible_records FROM public.previsit_call_data;
