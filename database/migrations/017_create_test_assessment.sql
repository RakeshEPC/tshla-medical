-- Create a test assessment for testing the access gate
-- This allows you to test the access gate without completing the full assessment flow

-- First, get your patient ID
-- Replace 'YOUR_EMAIL' with the email you registered with
DO $$
DECLARE
    v_patient_id UUID;
    v_auth_user_id UUID;
BEGIN
    -- Get the auth_user_id and patient_id for your test account
    -- You'll need to replace the email with your actual registered email
    SELECT auth_user_id, id INTO v_auth_user_id, v_patient_id
    FROM patients
    WHERE email = 'test1@example.com'  -- CHANGE THIS TO YOUR EMAIL
    LIMIT 1;

    IF v_patient_id IS NULL THEN
        RAISE NOTICE 'No patient found with that email. Please update the email in this script.';
        RAISE NOTICE 'Available patients:';
        RAISE NOTICE '%', (SELECT string_agg(email, ', ') FROM patients LIMIT 5);
    ELSE
        RAISE NOTICE 'Found patient: % (auth_user_id: %)', v_patient_id, v_auth_user_id;

        -- Create a test assessment
        INSERT INTO pump_assessments (
            patient_id,
            assessment_data,
            slider_responses,
            feature_selections,
            free_text_responses,
            access_type,
            payment_status,
            created_at,
            updated_at
        ) VALUES (
            v_auth_user_id,  -- Use auth_user_id as patient_id
            '{
                "test": true,
                "completed": true,
                "lifestyle": {
                    "activity_level": 7,
                    "tech_comfort": 8,
                    "management_style": 6
                }
            }'::jsonb,
            '{
                "activity_level": 7,
                "tech_comfort": 8,
                "management_style": 6,
                "carb_counting": 7,
                "site_rotation": 8
            }'::jsonb,
            '{
                "must_have": ["cgm_integration", "bolus_calculator"],
                "nice_to_have": ["touchscreen", "rechargeable"]
            }'::jsonb,
            '{
                "main_concerns": "I want better glucose control with minimal hassle",
                "current_challenges": "Forgetting to bolus, uncomfortable injections",
                "priorities": "Ease of use and CGM integration"
            }'::jsonb,
            'pending',  -- Will be set by access gate
            'pending',  -- Will be set by access gate
            NOW(),
            NOW()
        );

        RAISE NOTICE '✅ Test assessment created successfully!';
        RAISE NOTICE 'You can now visit the access gate page: /pumpdrive/access';
    END IF;
END $$;
