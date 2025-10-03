-- Migration: Add is_admin column to pump_users table
-- Date: 2025-10-03
-- Description: Implement proper role-based access control for PumpDrive users

-- Add is_admin column (safe to run multiple times)
ALTER TABLE pump_users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
AFTER is_research_participant;

-- Set admin flag for specific users
UPDATE pump_users
SET is_admin = TRUE
WHERE email IN ('rakesh@tshla.ai', 'admin@tshla.ai');

-- Verify admin users
SELECT id, email, username, is_admin, created_at
FROM pump_users
WHERE is_admin = TRUE;
