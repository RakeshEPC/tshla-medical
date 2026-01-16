-- Fix appointment_id column type in previsit_data
-- Should be INTEGER to match provider_schedules.id (BIGSERIAL), not UUID
-- Created: 2026-01-15

-- First, drop the existing appointment_id column with wrong type
ALTER TABLE previsit_data
  DROP COLUMN IF EXISTS appointment_id CASCADE;

-- Add it back with correct INTEGER type and foreign key
ALTER TABLE previsit_data
  ADD COLUMN appointment_id INTEGER REFERENCES provider_schedules(id) ON DELETE CASCADE;

-- Re-add unique constraint
ALTER TABLE previsit_data
  ADD CONSTRAINT previsit_data_appointment_id_key UNIQUE (appointment_id);

-- Re-add index for performance
CREATE INDEX IF NOT EXISTS idx_previsit_appointment ON previsit_data(appointment_id);

-- Add comment
COMMENT ON COLUMN previsit_data.appointment_id IS 'Reference to provider_schedules.id (integer, not UUID)';

-- Verify the column has correct type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'previsit_data'
    AND column_name = 'appointment_id'
    AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '✅ previsit_data.appointment_id is INTEGER type';
  ELSE
    RAISE EXCEPTION '❌ previsit_data.appointment_id is not INTEGER type';
  END IF;
END $$;
