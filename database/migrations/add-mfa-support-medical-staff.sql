-- =====================================================
-- Add Multi-Factor Authentication (MFA) for Medical Staff
-- Phase 4: HIPAA Compliance - Staff Extension
-- =====================================================
-- Adds TOTP-based 2FA columns to medical_staff table
-- Created: January 8, 2026
-- =====================================================

BEGIN;

-- Add MFA columns to medical_staff table
ALTER TABLE medical_staff
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret TEXT, -- Encrypted TOTP secret
ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[], -- Array of backup codes
ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS mfa_last_used_at TIMESTAMP;

-- Create index for MFA lookups
CREATE INDEX IF NOT EXISTS idx_medical_staff_mfa_enabled ON medical_staff(mfa_enabled) WHERE mfa_enabled = true;

COMMENT ON COLUMN medical_staff.mfa_enabled IS 'Whether MFA is enabled for this staff user';
COMMENT ON COLUMN medical_staff.mfa_secret IS 'Encrypted TOTP secret (base32 encoded)';
COMMENT ON COLUMN medical_staff.mfa_backup_codes IS 'Hashed backup codes for account recovery';
COMMENT ON COLUMN medical_staff.mfa_enabled_at IS 'Timestamp when MFA was first enabled';
COMMENT ON COLUMN medical_staff.mfa_last_used_at IS 'Timestamp of last successful MFA verification';

COMMIT;

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
    mfa_columns INTEGER;
BEGIN
    -- Count MFA columns
    SELECT COUNT(*) INTO mfa_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medical_staff'
      AND column_name IN ('mfa_enabled', 'mfa_secret', 'mfa_backup_codes');

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MEDICAL STAFF MFA MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MFA columns added: %', mfa_columns;
    RAISE NOTICE '';

    IF mfa_columns >= 3 THEN
        RAISE NOTICE '✅ MFA support successfully added to medical_staff table';
    ELSE
        RAISE WARNING '⚠️ Expected at least 3 MFA columns, found %', mfa_columns;
    END IF;
END $$;

-- Display new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'medical_staff'
  AND column_name LIKE 'mfa%'
ORDER BY ordinal_position;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MEDICAL STAFF MFA MIGRATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'What was added:';
    RAISE NOTICE '1. mfa_enabled - Boolean flag';
    RAISE NOTICE '2. mfa_secret - TOTP secret storage';
    RAISE NOTICE '3. mfa_backup_codes - Recovery codes';
    RAISE NOTICE '4. mfa_enabled_at - Enable timestamp';
    RAISE NOTICE '5. mfa_last_used_at - Usage tracking';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables with MFA Support:';
    RAISE NOTICE '✅ patients (pump tool users)';
    RAISE NOTICE '✅ medical_staff (doctors, nurses, admin)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Update medical-auth-api.js with MFA checks';
    RAISE NOTICE '2. Add MFA endpoints for staff';
    RAISE NOTICE '3. Update staff login flow';
    RAISE NOTICE '========================================';
END $$;
