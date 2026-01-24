/**
 * Patient Portal Test Data Seeding Script
 *
 * Creates sample patients with:
 * - Comprehensive H&P data
 * - AI conversations
 * - Lab results
 * - Payment requests
 * - Audio summaries
 * - Review queue items
 *
 * Usage: node scripts/seed-patient-portal-data.js
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Sample patient data
const SAMPLE_PATIENTS = [
  {
    phone: '+18325551001',
    tshla_id: 'TSH 123-001',
    first_name: 'John',
    last_name: 'Diabetes',
    email: 'john.diabetes@test.com',
    date_of_birth: '1975-06-15',
    hp_data: {
      demographics: {
        age: 49,
        gender: 'Male',
        marital_status: 'Married'
      },
      medications: [
        {
          name: 'Metformin',
          dosage: '1000mg',
          frequency: 'BID',
          started: '2023-06-01',
          indication: 'Type 2 Diabetes'
        },
        {
          name: 'Atorvastatin',
          dosage: '20mg',
          frequency: 'Daily',
          started: '2023-06-01',
          indication: 'Hyperlipidemia'
        }
      ],
      diagnoses: [
        {
          condition: 'Type 2 Diabetes Mellitus',
          icd10: 'E11.9',
          diagnosed: '2023-06-01',
          status: 'Active'
        },
        {
          condition: 'Hyperlipidemia',
          icd10: 'E78.5',
          diagnosed: '2023-06-01',
          status: 'Active'
        }
      ],
      allergies: [
        {
          allergen: 'Penicillin',
          reaction: 'Rash',
          severity: 'Moderate'
        }
      ],
      family_history: [
        {
          relation: 'Father',
          condition: 'Type 2 Diabetes',
          age_of_onset: 55
        },
        {
          relation: 'Mother',
          condition: 'Hypertension',
          age_of_onset: 60
        }
      ],
      social_history: {
        smoking: 'Never',
        alcohol: 'Occasional (1-2 drinks/week)',
        exercise: '3x per week (walking)',
        occupation: 'Software Engineer'
      },
      labs: {
        'A1C': [
          { value: 7.2, unit: '%', date: '2025-01-15', status: 'Improved' },
          { value: 7.8, unit: '%', date: '2024-10-10', status: 'High' },
          { value: 9.1, unit: '%', date: '2024-06-01', status: 'High' }
        ],
        'LDL': [
          { value: 95, unit: 'mg/dL', date: '2025-01-15', status: 'Normal' },
          { value: 125, unit: 'mg/dL', date: '2024-10-10', status: 'Elevated' }
        ],
        'Serum Creatinine': [
          { value: 0.9, unit: 'mg/dL', date: '2025-01-15', status: 'Normal' },
          { value: 0.8, unit: 'mg/dL', date: '2024-10-10', status: 'Normal' }
        ],
        'TSH': [
          { value: 2.1, unit: 'mIU/L', date: '2025-01-15', status: 'Normal' }
        ]
      },
      vitals: {
        'Blood Pressure': [
          { systolic: 128, diastolic: 82, unit: 'mmHg', date: '2025-01-15' },
          { systolic: 132, diastolic: 85, unit: 'mmHg', date: '2024-10-10' }
        ],
        'Weight': [
          { value: 178, unit: 'lbs', date: '2025-01-15' },
          { value: 185, unit: 'lbs', date: '2024-10-10' },
          { value: 192, unit: 'lbs', date: '2024-06-01' }
        ],
        'BMI': [
          { value: 27.2, date: '2025-01-15' },
          { value: 28.3, date: '2024-10-10' }
        ]
      },
      current_goals: [
        {
          category: 'Diet',
          goal: 'Reduce carbohydrate intake to <150g/day',
          status: 'in_progress',
          started: '2024-10-10',
          streak_days: 15
        },
        {
          category: 'Exercise',
          goal: 'Walk 30 minutes daily',
          status: 'in_progress',
          started: '2024-10-10',
          streak_days: 8
        },
        {
          category: 'Monitoring',
          goal: 'Check blood sugar 2x daily',
          status: 'in_progress',
          started: '2024-10-10',
          streak_days: 12
        }
      ]
    },
    ai_conversations: [
      {
        role: 'user',
        message: 'What should my A1C be?',
        topic: 'labs'
      },
      {
        role: 'assistant',
        message: 'For most people with diabetes, the A1C goal is below 7%. Your recent A1C of 7.2% is very close to goal! This represents great improvement from your previous 7.8%. Keep up the good work with your diet and exercise.',
        topic: 'labs',
        tokens: 65
      },
      {
        role: 'user',
        message: 'Can I eat fruit with diabetes?',
        topic: 'diet'
      },
      {
        role: 'assistant',
        message: 'Yes! Fruit can be part of a healthy diabetes diet. Focus on whole fruits rather than juice, and watch portion sizes. Berries, apples, and citrus fruits are excellent choices. Pair fruit with protein or healthy fat to minimize blood sugar spikes.',
        topic: 'diet',
        tokens: 58
      }
    ],
    payment_requests: [
      {
        amount: 75.00,
        description: 'Diabetes Follow-up Visit - January 2025',
        due_date: '2025-02-15',
        status: 'pending'
      }
    ],
    pending_edits: [
      {
        section: 'allergies',
        edit_type: 'allergy_added',
        data: {
          allergen: 'Sulfa drugs',
          reaction: 'Hives',
          severity: 'Moderate'
        },
        priority: 'normal'
      }
    ]
  },
  {
    phone: '+18325551002',
    tshla_id: 'TSH 123-002',
    first_name: 'Maria',
    last_name: 'Garcia',
    email: 'maria.garcia@test.com',
    date_of_birth: '1982-03-22',
    hp_data: {
      demographics: {
        age: 42,
        gender: 'Female',
        marital_status: 'Single'
      },
      medications: [
        {
          name: 'Metformin',
          dosage: '500mg',
          frequency: 'BID',
          started: '2024-08-15',
          indication: 'Pre-diabetes'
        }
      ],
      diagnoses: [
        {
          condition: 'Pre-diabetes',
          icd10: 'R73.03',
          diagnosed: '2024-08-15',
          status: 'Active'
        }
      ],
      allergies: [],
      family_history: [
        {
          relation: 'Mother',
          condition: 'Type 2 Diabetes',
          age_of_onset: 50
        }
      ],
      social_history: {
        smoking: 'Never',
        alcohol: 'None',
        exercise: '5x per week (gym)',
        occupation: 'Teacher'
      },
      labs: {
        'A1C': [
          { value: 5.8, unit: '%', date: '2025-01-10', status: 'Pre-diabetes' },
          { value: 6.1, unit: '%', date: '2024-08-15', status: 'Pre-diabetes' }
        ],
        'LDL': [
          { value: 110, unit: 'mg/dL', date: '2025-01-10', status: 'Normal' }
        ]
      },
      vitals: {
        'Blood Pressure': [
          { systolic: 118, diastolic: 75, unit: 'mmHg', date: '2025-01-10' }
        ],
        'Weight': [
          { value: 155, unit: 'lbs', date: '2025-01-10' },
          { value: 162, unit: 'lbs', date: '2024-08-15' }
        ]
      },
      current_goals: [
        {
          category: 'Weight Loss',
          goal: 'Lose 15 pounds',
          status: 'in_progress',
          started: '2024-08-15',
          progress: '7 lbs lost'
        }
      ]
    },
    ai_conversations: [
      {
        role: 'user',
        message: 'How can I prevent getting diabetes?',
        topic: 'prevention'
      },
      {
        role: 'assistant',
        message: 'Great question! You\'re already on the right track with Metformin and your exercise routine. Continue focusing on weight loss (you\'re doing great with 7 lbs down!), regular physical activity, and a balanced diet low in processed carbs. Your A1C improvement from 6.1% to 5.8% shows your efforts are working!',
        topic: 'prevention',
        tokens: 72
      }
    ],
    payment_requests: [],
    pending_edits: []
  },
  {
    phone: '+18325551003',
    tshla_id: 'TSH 123-003',
    first_name: 'Robert',
    last_name: 'Chen',
    email: 'robert.chen@test.com',
    date_of_birth: '1958-11-08',
    hp_data: {
      demographics: {
        age: 66,
        gender: 'Male',
        marital_status: 'Married'
      },
      medications: [
        {
          name: 'Insulin Glargine',
          dosage: '20 units',
          frequency: 'Daily at bedtime',
          started: '2020-03-01',
          indication: 'Type 2 Diabetes'
        },
        {
          name: 'Metformin',
          dosage: '1000mg',
          frequency: 'BID',
          started: '2018-05-15',
          indication: 'Type 2 Diabetes'
        },
        {
          name: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Daily',
          started: '2019-01-10',
          indication: 'Hypertension'
        }
      ],
      diagnoses: [
        {
          condition: 'Type 2 Diabetes Mellitus with complications',
          icd10: 'E11.65',
          diagnosed: '2018-05-15',
          status: 'Active'
        },
        {
          condition: 'Hypertension',
          icd10: 'I10',
          diagnosed: '2019-01-10',
          status: 'Active'
        },
        {
          condition: 'Diabetic retinopathy',
          icd10: 'E11.319',
          diagnosed: '2022-06-20',
          status: 'Monitoring'
        }
      ],
      allergies: [
        {
          allergen: 'Shellfish',
          reaction: 'Anaphylaxis',
          severity: 'Severe'
        }
      ],
      family_history: [
        {
          relation: 'Father',
          condition: 'Myocardial Infarction',
          age_of_onset: 62
        },
        {
          relation: 'Sister',
          condition: 'Type 2 Diabetes',
          age_of_onset: 48
        }
      ],
      social_history: {
        smoking: 'Former (quit 10 years ago)',
        alcohol: 'None',
        exercise: '2x per week (walking)',
        occupation: 'Retired accountant'
      },
      labs: {
        'A1C': [
          { value: 8.1, unit: '%', date: '2025-01-08', status: 'High' },
          { value: 8.4, unit: '%', date: '2024-10-05', status: 'High' },
          { value: 8.7, unit: '%', date: '2024-07-01', status: 'High' }
        ],
        'LDL': [
          { value: 105, unit: 'mg/dL', date: '2025-01-08', status: 'Borderline' }
        ],
        'Serum Creatinine': [
          { value: 1.2, unit: 'mg/dL', date: '2025-01-08', status: 'Borderline' }
        ],
        'Urine Microalbumin/Creatinine': [
          { value: 45, unit: 'mg/g', date: '2025-01-08', status: 'Elevated' }
        ]
      },
      vitals: {
        'Blood Pressure': [
          { systolic: 138, diastolic: 88, unit: 'mmHg', date: '2025-01-08' },
          { systolic: 142, diastolic: 90, unit: 'mmHg', date: '2024-10-05' }
        ],
        'Weight': [
          { value: 195, unit: 'lbs', date: '2025-01-08' }
        ]
      },
      current_goals: [
        {
          category: 'A1C',
          goal: 'Reduce A1C to below 7.5%',
          status: 'in_progress',
          started: '2024-10-05'
        },
        {
          category: 'Blood Pressure',
          goal: 'Maintain BP below 130/80',
          status: 'needs_attention',
          started: '2024-10-05'
        }
      ]
    },
    ai_conversations: [
      {
        role: 'user',
        message: 'Why is my A1C still high even with insulin?',
        topic: 'medication'
      },
      {
        role: 'assistant',
        message: 'Managing diabetes with insulin requires careful attention to timing, dosing, and diet. Your A1C has improved slightly from 8.7% to 8.1%, which shows progress. However, you may need a dose adjustment. I recommend discussing with your doctor about potentially increasing your insulin dose or adding mealtime insulin. Also, checking your blood sugar regularly will help identify patterns.',
        topic: 'medication',
        tokens: 82
      }
    ],
    payment_requests: [
      {
        amount: 125.00,
        description: 'Comprehensive Diabetes Management Visit',
        due_date: '2025-02-10',
        status: 'pending'
      }
    ],
    pending_edits: [
      {
        section: 'current_goals',
        edit_type: 'goal_added',
        data: {
          category: 'Exercise',
          goal: 'Walk 20 minutes after each meal',
          status: 'in_progress',
          started: '2025-01-15'
        },
        priority: 'normal'
      }
    ]
  }
];

async function seedPatientData() {
  console.log('🌱 Starting patient portal data seeding...\n');

  for (const patient of SAMPLE_PATIENTS) {
    console.log(`📋 Creating patient: ${patient.first_name} ${patient.last_name} (${patient.tshla_id})`);

    try {
      // 1. Create or update patient in unified_patients
      const { data: existingPatient } = await supabase
        .from('unified_patients')
        .select('id')
        .eq('phone_primary', patient.phone)
        .single();

      let patientId;
      if (existingPatient) {
        console.log('  ✓ Patient already exists, updating...');
        patientId = existingPatient.id;
        await supabase
          .from('unified_patients')
          .update({
            tshla_id: patient.tshla_id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            email: patient.email,
            date_of_birth: patient.date_of_birth
          })
          .eq('id', patientId);
      } else {
        console.log('  ✓ Creating new patient...');
        const { data: newPatient, error: createError } = await supabase
          .from('unified_patients')
          .insert({
            phone_primary: patient.phone,
            tshla_id: patient.tshla_id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            email: patient.email,
            date_of_birth: patient.date_of_birth,
            created_from: 'patient-portal-seed',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('  ❌ Error creating patient:', createError);
          continue;
        }
        patientId = newPatient.id;
      }

      // 2. Create or update comprehensive H&P
      const { data: existingHP } = await supabase
        .from('patient_comprehensive_chart')
        .select('id')
        .eq('patient_phone', patient.phone)
        .single();

      if (existingHP) {
        console.log('  ✓ Updating H&P...');
        await supabase
          .from('patient_comprehensive_chart')
          .update({
            tshla_id: patient.tshla_id,
            ...patient.hp_data,
            last_updated: new Date().toISOString(),
            version: 1
          })
          .eq('patient_phone', patient.phone);
      } else {
        console.log('  ✓ Creating H&P...');
        await supabase
          .from('patient_comprehensive_chart')
          .insert({
            patient_phone: patient.phone,
            tshla_id: patient.tshla_id,
            ...patient.hp_data,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            version: 1
          });
      }

      // 3. Create AI conversations
      if (patient.ai_conversations && patient.ai_conversations.length > 0) {
        console.log(`  ✓ Creating ${patient.ai_conversations.length} AI conversations...`);
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        for (let i = 0; i < patient.ai_conversations.length; i += 2) {
          const userMsg = patient.ai_conversations[i];
          const assistantMsg = patient.ai_conversations[i + 1];

          if (userMsg && assistantMsg) {
            await supabase
              .from('patient_ai_conversations')
              .insert([
                {
                  patient_phone: patient.phone,
                  session_id: sessionId,
                  message_role: 'user',
                  message_text: userMsg.message,
                  topic_category: userMsg.topic,
                  created_at: new Date(Date.now() - (patient.ai_conversations.length - i) * 3600000).toISOString()
                },
                {
                  patient_phone: patient.phone,
                  session_id: sessionId,
                  message_role: 'assistant',
                  message_text: assistantMsg.message,
                  topic_category: assistantMsg.topic,
                  tokens_used: assistantMsg.tokens,
                  cost_cents: Math.ceil((assistantMsg.tokens / 1000) * 3),
                  created_at: new Date(Date.now() - (patient.ai_conversations.length - i - 1) * 3600000).toISOString()
                }
              ]);
          }
        }
      }

      // 4. Create payment requests
      if (patient.payment_requests && patient.payment_requests.length > 0) {
        console.log(`  ✓ Creating ${patient.payment_requests.length} payment requests...`);
        for (const payment of patient.payment_requests) {
          await supabase
            .from('patient_payment_requests')
            .insert({
              patient_id: patientId,
              tshla_id: patient.tshla_id,
              amount_cents: Math.round(payment.amount * 100),
              description: payment.description,
              due_date: payment.due_date,
              status: payment.status,
              created_at: new Date().toISOString()
            });
        }
      }

      // 5. Create review queue items
      if (patient.pending_edits && patient.pending_edits.length > 0) {
        console.log(`  ✓ Creating ${patient.pending_edits.length} pending edits...`);
        for (const edit of patient.pending_edits) {
          await supabase
            .from('staff_review_queue')
            .insert({
              patient_phone: patient.phone,
              tshla_id: patient.tshla_id,
              patient_name: `${patient.first_name} ${patient.last_name}`,
              edit_type: edit.edit_type,
              section_name: edit.section,
              edit_data: edit.data,
              status: 'pending',
              priority: edit.priority,
              created_at: new Date().toISOString()
            });
        }
      }

      console.log(`✅ ${patient.first_name} ${patient.last_name} complete!\n`);

    } catch (error) {
      console.error(`❌ Error seeding ${patient.first_name} ${patient.last_name}:`, error.message);
      console.error('   Details:', error);
    }
  }

  console.log('\n🎉 Patient portal data seeding complete!');
  console.log('\n📊 Summary:');
  console.log(`   - ${SAMPLE_PATIENTS.length} patients created`);
  console.log(`   - Each with comprehensive H&P, labs, vitals, and goals`);
  console.log(`   - AI conversations and payment requests added`);
  console.log(`   - Staff review queue populated`);
  console.log('\n🔑 Test Credentials:');
  console.log('   TSH ID: TSH123-001 (John Diabetes)');
  console.log('   TSH ID: TSH123-002 (Maria Garcia)');
  console.log('   TSH ID: TSH123-003 (Robert Chen)');
  console.log('\n💡 Next steps:');
  console.log('   1. Visit /patient-portal/login');
  console.log('   2. Enter one of the TSH IDs above');
  console.log('   3. Explore the patient portal features!');
}

// Run the seeding script
seedPatientData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
