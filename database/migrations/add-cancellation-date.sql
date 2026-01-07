-- Add cancellation_date column to provider_schedules table
-- This stores when an appointment was cancelled

ALTER TABLE provider_schedules
ADD COLUMN IF NOT EXISTS cancellation_date DATE;

-- Add index for faster queries on cancelled appointments
CREATE INDEX IF NOT EXISTS idx_provider_schedules_cancellation_date
ON provider_schedules(cancellation_date)
WHERE cancellation_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN provider_schedules.cancellation_date IS 'Date when the appointment was cancelled (from Athena cancellation report)';
