-- Fix assessment patient_id to match the logged-in user
-- The access gate is searching for patient_id = 'b27a557b-1c8a-45a3-87ec-2e8dffb599b0'

DO $$
DECLARE
    v_target_patient_id UUID := 'b27a557b-1c8a-45a3-87ec-2e8dffb599b0'::uuid;
    v_assessment_count INT;
BEGIN
    -- Check if this patient exists
    IF NOT EXISTS (SELECT 1 FROM patients WHERE id = v_target_patient_id OR auth_user_id = v_target_patient_id) THEN
        RAISE EXCEPTION 'Patient with ID % not found in patients table', v_target_patient_id;
    END IF;

    -- Get the most recent assessment
    SELECT COUNT(*) INTO v_assessment_count
    FROM pump_assessments
    WHERE created_at > NOW() - INTERVAL '1 hour';

    IF v_assessment_count = 0 THEN
        RAISE NOTICE '❌ No assessments found in the last hour';
        RAISE NOTICE 'Need to create a new test assessment';
    ELSE
        RAISE NOTICE '✅ Found % assessment(s) in the last hour', v_assessment_count;

        -- Update the most recent assessment to use the correct patient_id
        UPDATE pump_assessments
        SET patient_id = v_target_patient_id
        WHERE id = (
            SELECT id
            FROM pump_assessments
            ORDER BY created_at DESC
            LIMIT 1
        );

        RAISE NOTICE '✅ Updated assessment patient_id to: %', v_target_patient_id;
        RAISE NOTICE 'Now refresh the page at /pumpdrive/access';
    END IF;
END $$;

-- Verify the fix
SELECT
    '=== VERIFICATION ===' as section,
    pa.id as assessment_id,
    pa.patient_id,
    pa.patient_name,
    pa.access_type,
    pa.created_at,
    CASE
        WHEN pa.patient_id = 'b27a557b-1c8a-45a3-87ec-2e8dffb599b0'::uuid
        THEN '✅ MATCHES search ID'
        ELSE '❌ Still wrong ID'
    END as status
FROM pump_assessments pa
ORDER BY pa.created_at DESC
LIMIT 1;
