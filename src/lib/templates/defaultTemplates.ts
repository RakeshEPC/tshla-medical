import { MedicalTemplate } from '@/types/template';

export const defaultTemplates: MedicalTemplate[] = [
  {
    id: 'diabetes-comprehensive',
    name: 'Diabetes Comprehensive Visit',
    specialty: 'endocrine',
    description:
      'Complete diabetes management visit with device review and complications screening',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    billingConfig: {
      enabled: true,
      includeICD10: true,
      includeTimeTracking: true,
      customInstructions: 'Track time spent on diabetes education and device training for accurate billing'
    },
    sections: [
      {
        id: 'glycemic-control',
        title: 'Glycemic Control Assessment',
        aiPrompt:
          "Extract and summarize: Current A1C, glucose patterns, time in range if CGM user, hypoglycemia frequency/severity, dawn phenomenon, postprandial excursions. Include patient's self-reported adherence and challenges.",
        placeholder: 'A1C: ___, TIR: ___%, Hypos/week: ___, Patterns noted...',
        order: 1,
        rows: 4,
        required: true,
      },
      {
        id: 'device-review',
        title: 'Device & Technology Review',
        aiPrompt:
          'Document: Insulin pump settings (basal rates, I:C ratios, ISF), CGM data review, recent adjustments made, download findings, alarm fatigue issues. For MDI users: injection technique, rotation sites, timing.',
        placeholder:
          'Current pump: ___, Basal total: ___ units/day, I:C: breakfast ___, lunch ___, dinner ___',
        order: 2,
        rows: 4,
      },
      {
        id: 'complications-screening',
        title: 'Complications Screening',
        aiPrompt:
          'Assess: Retinopathy status/last eye exam, nephropathy markers (ACR, eGFR), neuropathy symptoms (feet examination findings), cardiovascular risk factors. Include any new symptoms since last visit.',
        placeholder: 'Eyes: last exam ___, Feet: monofilament ___, ACR: ___, eGFR: ___',
        order: 3,
        rows: 3,
      },
      {
        id: 'lifestyle-factors',
        title: 'Lifestyle & Psychosocial',
        aiPrompt:
          'Document: Exercise routine and its glycemic impact, dietary patterns, carb counting accuracy, diabetes distress/burnout signs, sleep quality, work/school accommodations needed.',
        placeholder:
          'Exercise: ___ times/week, Carb counting confidence: ___/10, Diabetes distress: ___',
        order: 4,
        rows: 3,
      },
      {
        id: 'medication-optimization',
        title: 'Medication Management',
        aiPrompt:
          'Review: Current diabetes medications with doses/timing, adherence barriers, side effects, cost concerns, prior authorization needs. Include non-diabetes medications affecting glucose.',
        placeholder: 'Insulin: ___ units/day, Metformin: ___ mg, GLP-1: ___, Other: ___',
        order: 5,
        rows: 4,
        required: true,
      },
      {
        id: 'plan-actions',
        title: 'Plan & Action Items',
        aiPrompt:
          'Summarize: Medication changes, lifestyle recommendations, referrals needed, next labs, follow-up timing, patient education provided, goals set with patient.',
        placeholder: '1. Medication changes: ___\n2. Labs ordered: ___\n3. Follow-up: ___',
        order: 6,
        rows: 5,
        required: true,
      },
    ],
  },
  {
    id: 'thyroid-management',
    name: 'Thyroid Disorder Management',
    specialty: 'endocrine',
    description: 'Thyroid disease monitoring and medication optimization',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    billingConfig: {
      enabled: true,
      includeICD10: true,
      includeTimeTracking: true,
    },
    sections: [
      {
        id: 'thyroid-symptoms',
        title: 'Thyroid Symptom Review',
        aiPrompt:
          'Evaluate symptoms of hyper/hypothyroidism: Energy levels, weight changes, temperature intolerance, hair/skin changes, bowel patterns, menstrual changes, mood/cognition, palpitations, tremor.',
        placeholder:
          'Energy: ___/10, Weight change: ___ lbs over ___ months, Heat/cold intolerance: ___',
        order: 1,
        rows: 4,
        required: true,
      },
      {
        id: 'thyroid-labs',
        title: 'Laboratory Interpretation',
        aiPrompt:
          'Document: TSH trend, Free T4/T3 if applicable, antibodies (TPO, TSI, TRAb), thyroglobulin if post-cancer. Compare to previous values and target ranges.',
        placeholder: 'TSH: ___ (target: ___), FT4: ___, Previous TSH: ___, Trending: ___',
        order: 2,
        rows: 3,
        required: true,
      },
      {
        id: 'thyroid-exam',
        title: 'Thyroid Examination',
        aiPrompt:
          "Document: Thyroid size, nodularity, tenderness, lymph nodes, eye findings if Graves', skin changes, reflexes. Include ultrasound findings if available.",
        placeholder: 'Thyroid: size ___, nodules: ___, Reflexes: ___, Eye exam: ___',
        order: 3,
        rows: 3,
      },
      {
        id: 'medication-timing',
        title: 'Medication Optimization',
        aiPrompt:
          'Review: Levothyroxine dose/brand/timing, absorption factors (other meds, food, coffee), adherence patterns, generic vs brand preference, dose adjustments needed.',
        placeholder: 'Levothyroxine: ___ mcg daily, Taking: ___ mins before food, Brand: ___',
        order: 4,
        rows: 3,
        required: true,
      },
      {
        id: 'thyroid-plan',
        title: 'Plan & Monitoring',
        aiPrompt:
          'Document: Dose changes, next lab timing, imaging follow-up, symptoms to monitor, when to call, target ranges.',
        placeholder: 'Dose change: ___, Recheck labs: ___ weeks, Target TSH: ___',
        order: 5,
        rows: 4,
        required: true,
      },
    ],
  },
  {
    id: 'hormone-replacement',
    name: 'Hormone Replacement Therapy',
    specialty: 'endocrine',
    description: 'HRT evaluation and management for menopause/andropause',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    billingConfig: {
      enabled: true,
      includeICD10: true,
      includeTimeTracking: true,
    },
    sections: [
      {
        id: 'hrt-symptoms',
        title: 'Symptom Assessment',
        aiPrompt:
          'Document menopausal/andropausal symptoms: Hot flashes frequency/severity, night sweats, mood changes, libido, vaginal symptoms, energy, muscle mass changes, bone health concerns.',
        placeholder: 'Hot flashes: ___/day, Severity: ___/10, Night sweats: ___/week',
        order: 1,
        rows: 4,
        required: true,
      },
      {
        id: 'hrt-risks',
        title: 'Risk-Benefit Analysis',
        aiPrompt:
          'Assess: Cardiovascular history, thrombosis risk, breast/prostate cancer risk, family history, bone density status, contraindications. Calculate individual risk scores if applicable.',
        placeholder: 'Years since menopause: ___, BMD: ___, Family history: ___, Risk factors: ___',
        order: 2,
        rows: 4,
        required: true,
      },
      {
        id: 'hrt-regimen',
        title: 'Current Regimen Review',
        aiPrompt:
          'Document: Current hormone types/doses/routes, cycling pattern, side effects, breakthrough bleeding, breast tenderness, mood effects, compliance issues.',
        placeholder: 'Estrogen: ___ Route: ___, Progesterone: ___, Testosterone: ___',
        order: 3,
        rows: 3,
      },
      {
        id: 'hrt-monitoring',
        title: 'Monitoring Plan',
        aiPrompt:
          'Plan: Hormone level checks if indicated, mammogram schedule, bone density timing, symptom reassessment timeline, dose adjustments.',
        placeholder: 'Next mammogram: ___, DEXA: ___, Follow-up: ___ months',
        order: 4,
        rows: 3,
        required: true,
      },
    ],
  },
  {
    id: 'sports-injury',
    name: 'Athletic Injury Assessment',
    specialty: 'sports_medicine',
    description: 'Comprehensive sports injury evaluation and return-to-play planning',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    billingConfig: {
      enabled: true,
      includeICD10: true,
      includeTimeTracking: true,
    },
    sections: [
      {
        id: 'injury-history',
        title: 'Injury Mechanism & Timeline',
        aiPrompt:
          'Detail: Exact mechanism (contact vs non-contact), sport/activity, immediate symptoms, ability to continue playing, swelling onset, previous injuries to area. Include video review findings if available.',
        placeholder:
          'Sport: ___, Date: ___, Mechanism: ___, Immediate pain: ___/10, Swelling onset: ___',
        order: 1,
        rows: 4,
        required: true,
      },
      {
        id: 'functional-assessment',
        title: 'Functional Impact',
        aiPrompt:
          'Assess: Current pain with activities (walking, stairs, sport-specific), night pain, mechanical symptoms (locking, catching, giving way), activities limited, SANE/DASH/LEFS scores if applicable.',
        placeholder: 'Pain at rest: ___/10, With activity: ___/10, Can do: ___, Cannot do: ___',
        order: 2,
        rows: 3,
        required: true,
      },
      {
        id: 'biomechanical-exam',
        title: 'Biomechanical Analysis',
        aiPrompt:
          'Document: Range of motion (compare bilateral), strength testing (grade 0-5), special tests performed and results, movement quality assessment, kinetic chain evaluation, video analysis findings.',
        placeholder:
          'ROM: Flexion ___°, Extension ___°, Strength: ___/5, Special tests: (+) ___, (-) ___',
        order: 3,
        rows: 4,
        required: true,
      },
      {
        id: 'imaging-correlation',
        title: 'Imaging Correlation',
        aiPrompt:
          'Correlate clinical findings with imaging: X-ray, MRI, ultrasound findings. Note if imaging matches clinical picture. Include grade/classification of injury if applicable.',
        placeholder: 'Imaging: ___, Findings: ___, Clinical correlation: ___, Grade: ___',
        order: 4,
        rows: 3,
      },
      {
        id: 'treatment-plan',
        title: 'Treatment Plan',
        aiPrompt:
          'Outline: Immediate treatment (RICE, medications), therapy prescription (PT/OT frequency), injections if indicated, surgical discussion if relevant, activity modifications.',
        placeholder: 'Immediate: ___, PT: ___ x/week for ___ weeks, Restrictions: ___',
        order: 5,
        rows: 4,
        required: true,
      },
      {
        id: 'return-to-play',
        title: 'Return to Play Planning',
        aiPrompt:
          'Outline: Phase of recovery, criteria for progression, sport-specific requirements, estimated timeline, protective equipment needs, risk of reinjury discussion.',
        placeholder:
          'Current phase: ___/___, Target RTP: ___ weeks, Criteria met: ___, Restrictions: ___',
        order: 6,
        rows: 4,
        required: true,
      },
    ],
  },
  {
    id: 'performance-optimization',
    name: 'Athletic Performance Optimization',
    specialty: 'sports_medicine',
    description: 'Performance assessment and training optimization for athletes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    billingConfig: {
      enabled: true,
      includeICD10: true,
      includeTimeTracking: true,
    },
    sections: [
      {
        id: 'performance-goals',
        title: 'Performance Goals & Metrics',
        aiPrompt:
          'Document: Sport/position, current performance level, specific goals (speed, power, endurance), competition schedule, current training volume/intensity, recent performance tests.',
        placeholder: 'Sport: ___, Level: ___, Goal: ___, Current metrics: ___',
        order: 1,
        rows: 3,
        required: true,
      },
      {
        id: 'training-analysis',
        title: 'Training Load Analysis',
        aiPrompt:
          'Review: Weekly training hours, acute:chronic workload ratio, recovery between sessions, periodization phase, cross-training activities, recent changes in training.',
        placeholder: 'Hours/week: ___, Hard days: ___, Recovery days: ___, Current phase: ___',
        order: 2,
        rows: 3,
      },
      {
        id: 'recovery-assessment',
        title: 'Recovery & Regeneration',
        aiPrompt:
          'Assess: Sleep quality/duration, nutrition timing, hydration status, recovery modalities used, HRV trends if tracked, subjective recovery scores, signs of overtraining.',
        placeholder: 'Sleep: ___ hrs/night, Quality: ___/10, Recovery feel: ___/10, HRV trend: ___',
        order: 3,
        rows: 3,
      },
      {
        id: 'injury-prevention',
        title: 'Injury Risk Assessment',
        aiPrompt:
          'Screen for: Movement quality (FMS/similar), strength imbalances, flexibility deficits, previous injury areas, biomechanical faults, equipment issues.',
        placeholder: 'FMS score: ___/21, Asymmetries: ___, Risk factors: ___',
        order: 4,
        rows: 3,
        required: true,
      },
      {
        id: 'performance-plan',
        title: 'Performance Enhancement Plan',
        aiPrompt:
          'Recommend: Training modifications, strength/conditioning focus areas, recovery protocols, nutrition adjustments, mental performance strategies, equipment optimization.',
        placeholder: 'Focus areas: ___, Modifications: ___, Timeline: ___',
        order: 5,
        rows: 4,
        required: true,
      },
    ],
  },
  {
    id: 'concussion-protocol',
    name: 'Concussion Management Protocol',
    specialty: 'sports_medicine',
    description: 'Systematic concussion assessment and graduated return protocol',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    billingConfig: {
      enabled: true,
      includeICD10: true,
      includeTimeTracking: true,
    },
    sections: [
      {
        id: 'concussion-acute',
        title: 'Acute Presentation',
        aiPrompt:
          'Document: Mechanism, loss of consciousness, amnesia (retrograde/anterograde), initial symptoms, sideline assessment findings (SCAT5), removal from play decision.',
        placeholder: 'LOC: ___ seconds, Amnesia: ___, SCAT5: ___/__, Removed: yes/no',
        order: 1,
        rows: 4,
        required: true,
      },
      {
        id: 'symptom-tracking',
        title: 'Symptom Evolution',
        aiPrompt:
          'Track: Headache, dizziness, nausea, light/noise sensitivity, cognitive symptoms, sleep disturbance, mood changes. Use graded symptom scale. Compare to baseline if available.',
        placeholder: 'Symptom score: ___/132, Worst symptoms: ___, Improving/worsening: ___',
        order: 2,
        rows: 4,
        required: true,
      },
      {
        id: 'cognitive-assessment',
        title: 'Cognitive Function',
        aiPrompt:
          'Assess: Concentration, memory, processing speed, academic/work performance, screen time tolerance, cognitive fatigue patterns. Include ImPACT or similar testing results.',
        placeholder: 'ImPACT: ___, School tolerance: ___ hrs, Cognitive fatigue: ___',
        order: 3,
        rows: 3,
      },
      {
        id: 'physical-exam',
        title: 'Physical Examination',
        aiPrompt:
          'Document: Neurological exam, balance testing (BESS), vestibular/ocular assessment, cervical spine evaluation, exertion testing if appropriate.',
        placeholder: 'BESS errors: ___, Convergence: ___ cm, Cervical: ___',
        order: 4,
        rows: 3,
      },
      {
        id: 'graduated-rtp',
        title: 'Graduated Return Protocol',
        aiPrompt:
          'Document: Current stage (1-6), symptoms with activity, progression criteria met, setbacks, estimated timeline, academic accommodations needed.',
        placeholder:
          'Stage: ___/6, Days at stage: ___, Symptoms with exertion: ___, Target RTP: ___',
        order: 5,
        rows: 4,
        required: true,
      },
    ],
  },
];
