-- Create table for storing pre-visit call data captured in real-time
CREATE TABLE IF NOT EXISTS public.previsit_call_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  medications JSONB DEFAULT '[]'::jsonb,
  concerns JSONB DEFAULT '[]'::jsonb,
  questions JSONB DEFAULT '[]'::jsonb,
  urgency_flags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on conversation_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_previsit_conversation_id ON public.previsit_call_data(conversation_id);

-- Create index on started_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_previsit_started_at ON public.previsit_call_data(started_at DESC);

-- Enable Row Level Security
ALTER TABLE public.previsit_call_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all records
CREATE POLICY "Allow authenticated read access" ON public.previsit_call_data
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role full access" ON public.previsit_call_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.previsit_call_data IS 'Stores structured data captured during pre-visit phone calls via ElevenLabs tools';
