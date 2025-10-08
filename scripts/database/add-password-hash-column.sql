-- Add missing password_hash column to pump_users table
-- Run this in Supabase SQL Editor at: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/sql

-- Add password_hash column (used for traditional password authentication)
ALTER TABLE public.pump_users
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pump_users'
  AND column_name = 'password_hash';

-- Success message
SELECT 'password_hash column added successfully!' as status;
