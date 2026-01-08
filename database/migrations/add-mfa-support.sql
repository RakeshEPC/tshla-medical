-- =====================================================
-- Add Multi-Factor Authentication (MFA) Support
-- Phase 4: HIPAA Compliance
-- =====================================================
-- Adds TOTP-based 2FA columns to patients table
-- Created: January 8, 2026
-- =====================================================

BEGIN;

-- Add MFA columns to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret TEXT, -- Encrypted TOTP secret
ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[], -- Array of backup codes
ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS mfa_last_used_at TIMESTAMP;

-- Create index for MFA lookups
CREATE INDEX IF NOT EXISTS idx_patients_mfa_enabled ON patients(mfa_enabled) WHERE mfa_enabled = true;

-- Add audit logging for MFA events
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS mfa_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_method TEXT; -- 'totp', 'backup_code', 'recovery'

COMMENT ON COLUMN patients.mfa_enabled IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN patients.mfa_secret IS 'Encrypted TOTP secret (base32 encoded)';
COMMENT ON COLUMN patients.mfa_backup_codes IS 'Hashed backup codes for account recovery';
COMMENT ON COLUMN patients.mfa_enabled_at IS 'Timestamp when MFA was first enabled';
COMMENT ON COLUMN patients.mfa_last_used_at IS 'Timestamp of last successful MFA verification';

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
      AND table_name = 'patients'
      AND column_name IN ('mfa_enabled', 'mfa_secret', 'mfa_backup_codes');

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MFA MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MFA columns added: %', mfa_columns;
    RAISE NOTICE '';

    IF mfa_columns >= 3 THEN
        RAISE NOTICE '✅ MFA support successfully added to patients table';
    ELSE
        RAISE WARNING '⚠️ Expected at least 3 MFA columns, found %', mfa_columns;
    END IF;
END $$;

-- Display new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patients'
  AND column_name LIKE 'mfa%'
ORDER BY ordinal_position;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MFA SUPPORT MIGRATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'What was added:';
    RAISE NOTICE '1. mfa_enabled - Boolean flag';
    RAISE NOTICE '2. mfa_secret - TOTP secret storage';
    RAISE NOTICE '3. mfa_backup_codes - Recovery codes';
    RAISE NOTICE '4. mfa_enabled_at - Enable timestamp';
    RAISE NOTICE '5. mfa_last_used_at - Usage tracking';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Deploy MFA service';
    RAISE NOTICE '2. Add MFA API endpoints';
    RAISE NOTICE '3. Create frontend MFA components';
    RAISE NOTICE '========================================';
END $$;
