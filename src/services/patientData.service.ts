export interface PatientData {
  id: string;
  name: string;
  mrn: string;
  dob: string;
  diagnosis: string[];
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    indication: string;
  }>;
  labResults: Array<{
    test: string;
    value: string;
    normal: string;
    date: string;
  }>;
  vitalSigns: {
    bp: string;
    hr: string;
    temp: string;
    weight: string;
    bmi: string;
    glucose?: string;
  };
  mentalHealth?: {
    phq9Score?: number;
    gad7Score?: number;
    lastScreening?: string;
  };
}

const generatePatientData = (id: string): PatientData => {
  const num = parseInt(id.replace(/-/g, ''));
  const isEndocrine = num % 2 === 0;

  const names = [
    'Sarah Johnson',
    'Michael Chen',
    'Emily Rodriguez',
    'David Kim',
    'Jessica Brown',
    'Robert Taylor',
    'Maria Garcia',
    'James Wilson',
    'Linda Martinez',
    'William Anderson',
  ];

  const endocrineDiagnoses = [
    ['Type 2 Diabetes Mellitus', 'Hypothyroidism'],
    ['Type 1 Diabetes Mellitus', 'Diabetic Neuropathy'],
    ["Hashimoto's Thyroiditis", 'Insulin Resistance'],
    ["Graves' Disease", 'Hyperthyroidism'],
    ['PCOS', 'Metabolic Syndrome'],
    ["Cushing's Syndrome", 'Adrenal Insufficiency'],
  ];

  const psychDiagnoses = [
    ['Major Depressive Disorder', 'Generalized Anxiety Disorder'],
    ['Bipolar Disorder Type II', 'ADHD'],
    ['PTSD', 'Panic Disorder'],
    ['OCD', 'Social Anxiety Disorder'],
    ['Adjustment Disorder', 'Insomnia'],
    ['Schizophrenia', 'Substance Use Disorder'],
  ];

  const endocrineMeds = [
    {
      name: 'Metformin',
      dosage: '1000mg',
      frequency: 'Twice daily',
      indication: 'Type 2 Diabetes',
    },
    {
      name: 'Insulin Glargine',
      dosage: '20 units',
      frequency: 'Once daily at bedtime',
      indication: 'Diabetes',
    },
    {
      name: 'Levothyroxine',
      dosage: '100mcg',
      frequency: 'Once daily',
      indication: 'Hypothyroidism',
    },
    { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', indication: 'Hypertension' },
    { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily', indication: 'Hyperlipidemia' },
  ];

  const psychMeds = [
    { name: 'Sertraline', dosage: '100mg', frequency: 'Once daily', indication: 'Depression' },
    { name: 'Escitalopram', dosage: '20mg', frequency: 'Once daily', indication: 'Anxiety' },
    { name: 'Alprazolam', dosage: '0.5mg', frequency: 'As needed', indication: 'Panic attacks' },
    { name: 'Bupropion XL', dosage: '300mg', frequency: 'Once daily', indication: 'Depression' },
    { name: 'Quetiapine', dosage: '50mg', frequency: 'At bedtime', indication: 'Bipolar disorder' },
  ];

  const endocrineLabResults = [
    { test: 'HbA1c', value: '7.2%', normal: '<5.7%', date: '2025-01-15' },
    { test: 'Fasting Glucose', value: '142 mg/dL', normal: '70-100 mg/dL', date: '2025-01-15' },
    { test: 'TSH', value: '5.8 mIU/L', normal: '0.4-4.0 mIU/L', date: '2025-01-10' },
    { test: 'T4 Free', value: '0.9 ng/dL', normal: '0.9-1.7 ng/dL', date: '2025-01-10' },
    { test: 'Cholesterol', value: '210 mg/dL', normal: '<200 mg/dL', date: '2024-12-20' },
  ];

  const psychLabResults = [
    { test: 'TSH', value: '2.5 mIU/L', normal: '0.4-4.0 mIU/L', date: '2025-01-10' },
    { test: 'Vitamin D', value: '22 ng/mL', normal: '30-100 ng/mL', date: '2025-01-10' },
    { test: 'B12', value: '450 pg/mL', normal: '200-900 pg/mL', date: '2024-12-15' },
    { test: 'Folate', value: '12 ng/mL', normal: '>5.4 ng/mL', date: '2024-12-15' },
    { test: 'CBC', value: 'Normal', normal: 'Normal ranges', date: '2024-12-10' },
  ];

  return {
    id: `pt-${id}`,
    name: names[num % names.length],
    mrn: `MRN${id.replace(/-/g, '')}`,
    dob: `19${50 + (num % 50)}-${String((num % 12) + 1).padStart(2, '0')}-${String((num % 28) + 1).padStart(2, '0')}`,
    diagnosis: isEndocrine
      ? endocrineDiagnoses[num % endocrineDiagnoses.length]
      : psychDiagnoses[num % psychDiagnoses.length],
    medications: isEndocrine
      ? endocrineMeds.slice(0, 3 + (num % 3))
      : psychMeds.slice(0, 2 + (num % 3)),
    labResults: isEndocrine ? endocrineLabResults : psychLabResults,
    vitalSigns: {
      bp: isEndocrine ? '138/88' : '120/80',
      hr: isEndocrine ? '78' : '72',
      temp: '98.6°F',
      weight: `${150 + (num % 100)} lbs`,
      bmi: `${22 + (num % 15)}`,
      glucose: isEndocrine ? `${100 + (num % 80)} mg/dL` : undefined,
    },
    mentalHealth: !isEndocrine
      ? {
          phq9Score: 5 + (num % 15),
          gad7Score: 4 + (num % 12),
          lastScreening: '2025-01-10',
        }
      : undefined,
  };
};

// Generate patient data for IDs 111-111 through 999-999
export const patientDatabase = new Map<string, PatientData>();

for (let i = 111; i <= 999; i += 111) {
  const id = `${i}-${i}`;
  patientDatabase.set(id, generatePatientData(id));
}

// Special case for 444-444 (used in examples)
patientDatabase.set('444-444', {
  id: 'pt-444-444',
  name: 'John Smith',
  mrn: 'MRN444444',
  dob: '1985-03-15',
  diagnosis: ['Type 2 Diabetes Mellitus', 'Hypertension', 'Hyperlipidemia'],
  medications: [
    {
      name: 'Metformin',
      dosage: '1000mg',
      frequency: 'Twice daily',
      indication: 'Type 2 Diabetes',
    },
    {
      name: 'Insulin Glargine',
      dosage: '20 units',
      frequency: 'Once daily at bedtime',
      indication: 'Diabetes',
    },
    { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', indication: 'Hypertension' },
    {
      name: 'Atorvastatin',
      dosage: '20mg',
      frequency: 'Once daily at bedtime',
      indication: 'Hyperlipidemia',
    },
  ],
  labResults: [
    { test: 'HbA1c', value: '6.8%', normal: '<5.7%', date: '2025-01-15' },
    { test: 'Fasting Glucose', value: '126 mg/dL', normal: '70-100 mg/dL', date: '2025-01-15' },
    { test: 'Cholesterol', value: '185 mg/dL', normal: '<200 mg/dL', date: '2024-12-20' },
    { test: 'LDL', value: '110 mg/dL', normal: '<100 mg/dL', date: '2024-12-20' },
    { test: 'Blood Pressure', value: '132/84', normal: '<120/80', date: '2025-01-15' },
  ],
  vitalSigns: {
    bp: '132/84',
    hr: '72',
    temp: '98.6°F',
    weight: '185 lbs',
    bmi: '28.2',
    glucose: '126 mg/dL',
  },
});

export const getPatientData = (patientId: string): PatientData | undefined => {
  // Remove 'pt-' prefix if present
  const cleanId = patientId.replace('pt-', '');
  return patientDatabase.get(cleanId);
};
