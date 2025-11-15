-- Add pre-visit tracking fields to provider_schedules table

ALTER TABLE public.provider_schedules
  ADD COLUMN IF NOT EXISTS previsit_call_id UUID REFERENCES public.previsit_call_data(id),
  ADD COLUMN IF NOT EXISTS previsit_data_captured BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_schedules_previsit
  ON public.provider_schedules(previsit_call_id);

CREATE INDEX IF NOT EXISTS idx_provider_schedules_previsit_captured
  ON public.provider_schedules(previsit_data_captured);

-- Add comment
COMMENT ON COLUMN public.provider_schedules.previsit_call_id
  IS 'Links to previsit_call_data table for pre-visit phone call data';

COMMENT ON COLUMN public.provider_schedules.previsit_data_captured
  IS 'Indicates if pre-visit data has been captured for this appointment';
