-- Diagnostic: Check if assessment exists and why it's not showing

-- Step 1: Check recent patients
SELECT 'Recent Patients:' as info;
SELECT id, auth_user_id, email, created_at
FROM patients
ORDER BY created_at DESC
LIMIT 3;

-- Step 2: Check recent assessments
SELECT 'Recent Assessments:' as info;
SELECT id, patient_id, access_type, payment_status, created_at
FROM pump_assessments
ORDER BY created_at DESC
LIMIT 3;

-- Step 3: Check if there's a mismatch
-- The access gate is looking for assessments where patient_id = your auth_user_id
SELECT 'Checking for mismatches:' as info;
SELECT
    p.email,
    p.auth_user_id as "User Auth ID",
    pa.patient_id as "Assessment Patient ID",
    CASE
        WHEN p.auth_user_id = pa.patient_id THEN '✅ MATCH'
        ELSE '❌ MISMATCH - This is the problem!'
    END as status
FROM patients p
LEFT JOIN pump_assessments pa ON pa.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC
LIMIT 5;
