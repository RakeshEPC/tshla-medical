-- Diagnostic: Check ID mismatch between user and assessment
-- The access gate is searching for: b27a557b-1c8a-45a3-87ec-2e8dffb599b0

SELECT
    '=== RECENT PATIENT ===' as section,
    p.id as "patients.id (FK target)",
    p.auth_user_id as "auth_user_id",
    p.email,
    CONCAT(p.first_name, ' ', p.last_name) as full_name,
    p.created_at
FROM patients p
ORDER BY p.created_at DESC
LIMIT 1;

SELECT
    '=== RECENT ASSESSMENT ===' as section,
    pa.id as assessment_id,
    pa.patient_id as "assessment.patient_id",
    pa.patient_name,
    pa.access_type,
    pa.payment_status,
    pa.created_at
FROM pump_assessments pa
ORDER BY pa.created_at DESC
LIMIT 1;

SELECT
    '=== ID COMPARISON ===' as section,
    CASE
        WHEN p.id = 'b27a557b-1c8a-45a3-87ec-2e8dffb599b0'::uuid
        THEN '✅ patients.id MATCHES search ID'
        ELSE '❌ patients.id does NOT match'
    END as id_check,
    CASE
        WHEN p.auth_user_id = 'b27a557b-1c8a-45a3-87ec-2e8dffb599b0'::uuid
        THEN '✅ auth_user_id MATCHES search ID'
        ELSE '❌ auth_user_id does NOT match'
    END as auth_id_check
FROM patients p
ORDER BY p.created_at DESC
LIMIT 1;

SELECT
    '=== DOES ASSESSMENT EXIST FOR THIS USER? ===' as section,
    COUNT(*) as assessment_count,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ Assessment exists'
        ELSE '❌ No assessment found - THIS IS THE PROBLEM'
    END as status
FROM pump_assessments pa
WHERE pa.patient_id = 'b27a557b-1c8a-45a3-87ec-2e8dffb599b0'::uuid;
