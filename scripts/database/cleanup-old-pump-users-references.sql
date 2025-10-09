-- Clean up old pump_users table references
-- Creates a view for backward compatibility if needed

-- Drop the old pump_users table if it exists (we use patients now)
DROP TABLE IF EXISTS pump_users CASCADE;

-- Create a view called pump_users that points to patients
-- This provides backward compatibility for any old queries
CREATE OR REPLACE VIEW pump_users AS
SELECT
    id,
    auth_user_id as user_id,
    email,
    first_name,
    last_name,
    phone as phone_number,
    ava_id,
    pumpdrive_enabled,
    pumpdrive_signup_date as signup_date,
    pumpdrive_last_assessment as last_assessment,
    assessments_completed,
    subscription_tier,
    is_active,
    created_at,
    updated_at
FROM patients
WHERE pumpdrive_enabled = true;

-- Add comment
COMMENT ON VIEW pump_users IS 'Backward compatibility view - use patients table instead';

-- Verify the view
SELECT
    COUNT(*) as total_pumpdrive_users,
    COUNT(CASE WHEN is_active THEN 1 END) as active_users
FROM pump_users;
