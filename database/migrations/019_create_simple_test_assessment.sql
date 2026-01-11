-- Create a simple test assessment using only columns we know exist
-- Based on the migrations we ran: patient_id, access_type, payment_status, access_granted_at

DO $$
DECLARE
    v_auth_user_id UUID;
    v_email TEXT;
BEGIN
    -- Get the most recent patient (likely your test account)
    SELECT auth_user_id, email INTO v_auth_user_id, v_email
    FROM patients
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'No patients found in database';
    END IF;

    RAISE NOTICE 'Creating assessment for: % (auth_user_id: %)', v_email, v_auth_user_id;

    -- Insert a minimal test assessment with only the columns we're sure exist
    INSERT INTO pump_assessments (
        patient_id,
        access_type,
        payment_status,
        created_at
    ) VALUES (
        v_auth_user_id,
        'pending',
        'pending',
        NOW()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Test assessment created!';
    RAISE NOTICE 'Now refresh your browser at /pumpdrive/access';
END $$;
