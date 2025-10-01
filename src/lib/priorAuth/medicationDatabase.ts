import { PriorAuthMedication } from '@/types/priorAuth';

export const priorAuthMedications: PriorAuthMedication[] = [
  // ===== DIABETES MEDICATIONS =====
  {
    brandName: 'Ozempic',
    genericName: 'semaglutide',
    category: 'diabetes',
    commonICD10: ['E11.9', 'E11.65', 'E11.69', 'Z68.41', 'Z68.42', 'Z68.43', 'Z68.44', 'Z68.45'],
    typicalRequirements: [
      'Failed metformin trial (3+ months)',
      'Current A1C > 7.0%',
      'BMI > 27 with comorbidity OR BMI > 30',
      'Documented adherence to lifestyle modifications',
    ],
    alternatives: [
      { name: 'Metformin', generic: 'metformin', priorAuthRequired: false, tier: 1 },
      { name: 'Trulicity', generic: 'dulaglutide', priorAuthRequired: true, tier: 3 },
      { name: 'Victoza', generic: 'liraglutide', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['A1C within 90 days', 'Creatinine/eGFR', 'Liver function tests'],
    clinicalCriteria: [
      'Type 2 diabetes diagnosis',
      'Inadequate control on current therapy',
      'No personal/family history of medullary thyroid carcinoma',
      'No history of pancreatitis',
    ],
    averageApprovalTime: '3-5 business days',
    successRate: 75,
    forms: ['CVS_Caremark_GLP1', 'Express_Scripts_Diabetes', 'United_Specialty'],
  },
  {
    brandName: 'Mounjaro',
    genericName: 'tirzepatide',
    category: 'diabetes',
    commonICD10: ['E11.9', 'E11.65', 'E11.69', 'Z68.41', 'Z68.42', 'Z68.43', 'Z68.44', 'Z68.45'],
    typicalRequirements: [
      'Failed TWO other diabetes medications',
      'A1C > 7.5% despite current therapy',
      'Documented medical necessity over GLP-1 agonists',
      'BMI documentation if using for weight',
    ],
    alternatives: [
      { name: 'Ozempic', generic: 'semaglutide', priorAuthRequired: true, tier: 3 },
      {
        name: 'Metformin + Jardiance',
        priorAuthRequired: false,
        tier: 2,
        notes: 'Combination therapy',
      },
    ],
    labsRequired: ['A1C within 60 days', 'Lipid panel', 'Comprehensive metabolic panel'],
    clinicalCriteria: [
      'Failed or contraindicated to metformin AND one other agent',
      'Cardiovascular disease or high risk',
      'No active gallbladder disease',
    ],
    averageApprovalTime: '5-7 business days',
    successRate: 65,
    forms: ['Universal_PA_Form', 'Optum_Specialty_Diabetes'],
  },
  {
    brandName: 'Jardiance',
    genericName: 'empagliflozin',
    category: 'diabetes',
    commonICD10: ['E11.9', 'E11.65', 'I50.9', 'N18.3', 'N18.4'],
    typicalRequirements: [
      'Type 2 diabetes diagnosis',
      'eGFR > 30 mL/min',
      'Failed or contraindicated to metformin',
      'If for heart failure: documented HFrEF',
    ],
    alternatives: [
      { name: 'Metformin', generic: 'metformin', priorAuthRequired: false, tier: 1 },
      { name: 'Farxiga', generic: 'dapagliflozin', priorAuthRequired: true, tier: 3 },
      { name: 'Invokana', generic: 'canagliflozin', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['eGFR within 30 days', 'A1C', 'Potassium'],
    clinicalCriteria: [
      'No history of recurrent UTIs',
      'No active genital infections',
      'Adequate renal function',
    ],
    averageApprovalTime: '2-3 business days',
    successRate: 80,
    forms: ['SGLT2_Standard_Form'],
  },
  {
    brandName: 'Tresiba',
    genericName: 'insulin degludec',
    category: 'diabetes',
    commonICD10: ['E11.9', 'E10.9', 'E11.65', 'E10.65'],
    typicalRequirements: [
      'Failed insulin glargine (Lantus/Basaglar)',
      'Documented hypoglycemia on other basal insulin',
      'Variable schedule requiring flexible dosing',
      'A1C documentation',
    ],
    alternatives: [
      { name: 'Lantus', generic: 'insulin glargine', priorAuthRequired: false, tier: 2 },
      { name: 'Basaglar', generic: 'insulin glargine', priorAuthRequired: false, tier: 2 },
      { name: 'Levemir', generic: 'insulin detemir', priorAuthRequired: false, tier: 2 },
    ],
    labsRequired: ['A1C within 90 days', 'Glucose logs showing hypoglycemia'],
    clinicalCriteria: [
      'Type 1 or Type 2 diabetes',
      'Requiring basal insulin',
      'Clinical reason for ultra-long acting insulin',
    ],
    averageApprovalTime: '2-4 business days',
    successRate: 70,
    forms: ['Insulin_PA_Standard'],
  },
  {
    brandName: 'Rybelsus',
    genericName: 'oral semaglutide',
    category: 'diabetes',
    commonICD10: ['E11.9', 'E11.65', 'E11.69'],
    typicalRequirements: [
      'Unable to use injectable GLP-1',
      'Failed metformin',
      'A1C > 7.0%',
      'Documented injection phobia or inability',
    ],
    alternatives: [
      { name: 'Metformin ER', priorAuthRequired: false, tier: 1 },
      { name: 'Januvia', generic: 'sitagliptin', priorAuthRequired: true, tier: 3 },
      {
        name: 'Injectable Ozempic',
        priorAuthRequired: true,
        tier: 3,
        notes: 'Same drug, different route',
      },
    ],
    labsRequired: ['A1C within 90 days', 'Renal function'],
    clinicalCriteria: [
      'Type 2 diabetes',
      'Contraindication or intolerance to injections',
      'Able to follow complex dosing instructions',
    ],
    averageApprovalTime: '3-5 business days',
    successRate: 60,
    forms: ['Oral_GLP1_PA'],
  },

  // ===== THYROID/ENDOCRINE =====
  {
    brandName: 'Synthroid',
    genericName: 'levothyroxine',
    category: 'thyroid',
    commonICD10: ['E03.9', 'E89.0', 'E06.3', 'C73'],
    typicalRequirements: [
      'Documented intolerance to generic levothyroxine',
      'Unstable TSH on generic',
      'Post-thyroidectomy or thyroid cancer',
      'Pregnancy',
    ],
    alternatives: [
      { name: 'Generic levothyroxine', priorAuthRequired: false, tier: 1 },
      { name: 'Levoxyl', priorAuthRequired: true, tier: 3 },
      { name: 'Tirosint', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['TSH within 30 days', 'Free T4 if indicated'],
    clinicalCriteria: [
      'Hypothyroidism diagnosis',
      'Clinical necessity for brand over generic',
      'Documentation of generic failure',
    ],
    averageApprovalTime: '1-2 business days',
    successRate: 85,
    forms: ['Brand_Thyroid_PA'],
  },
  {
    brandName: 'Armour Thyroid',
    genericName: 'desiccated thyroid',
    category: 'thyroid',
    commonICD10: ['E03.9', 'E06.3'],
    typicalRequirements: [
      'Failed synthetic thyroid hormone',
      'Patient preference with documentation',
      'Persistent symptoms on levothyroxine',
      'Normal TSH but symptomatic',
    ],
    alternatives: [
      { name: 'Levothyroxine', priorAuthRequired: false, tier: 1 },
      {
        name: 'Levothyroxine + Cytomel',
        priorAuthRequired: true,
        tier: 3,
        notes: 'Synthetic T4/T3 combo',
      },
      { name: 'NP Thyroid', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['TSH', 'Free T4', 'Free T3', 'Reverse T3 (optional)'],
    clinicalCriteria: [
      'Documented trial of synthetic hormone',
      'Continued symptoms despite normal labs',
      'No cardiac contraindications',
    ],
    averageApprovalTime: '3-5 business days',
    successRate: 50,
    forms: ['Desiccated_Thyroid_PA'],
  },
  {
    brandName: 'AndroGel',
    genericName: 'testosterone gel',
    category: 'thyroid',
    commonICD10: ['E29.1', 'E89.5', 'M81.0'],
    typicalRequirements: [
      'Two low morning testosterone levels',
      'Symptoms of hypogonadism',
      'PSA and hematocrit checked',
      'No prostate cancer history',
    ],
    alternatives: [
      { name: 'Generic testosterone gel', priorAuthRequired: false, tier: 2 },
      { name: 'Testosterone cypionate injection', priorAuthRequired: false, tier: 1 },
      { name: 'Testim', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['Two morning testosterone levels < 300', 'PSA', 'CBC', 'LFTs'],
    clinicalCriteria: ['Clinical hypogonadism', 'No contraindications', 'Baseline labs obtained'],
    averageApprovalTime: '2-4 business days',
    successRate: 75,
    forms: ['Testosterone_Replacement_PA'],
  },

  // ===== SPORTS MEDICINE/PAIN =====
  {
    brandName: 'Euflexxa',
    genericName: 'sodium hyaluronate',
    category: 'injectable',
    commonICD10: ['M17.11', 'M17.12', 'M17.0', 'M17.9'],
    typicalRequirements: [
      'Failed conservative treatment (3+ months)',
      'Failed oral NSAIDs and physical therapy',
      'X-ray showing osteoarthritis',
      'Not bone-on-bone arthritis',
    ],
    alternatives: [
      { name: 'Cortisone injection', priorAuthRequired: false, tier: 1 },
      { name: 'Synvisc', priorAuthRequired: true, tier: 3 },
      { name: 'Orthovisc', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['X-ray within 6 months'],
    clinicalCriteria: [
      'Knee osteoarthritis grade 2-3',
      'Failed conservative measures',
      'No active infection',
      'Candidate for injection therapy',
    ],
    averageApprovalTime: '5-7 business days',
    successRate: 60,
    forms: ['Viscosupplementation_PA'],
  },
  {
    brandName: 'Celebrex',
    genericName: 'celecoxib',
    category: 'pain',
    commonICD10: ['M25.511', 'M17.11', 'M19.90', 'M79.3'],
    typicalRequirements: [
      'Failed two generic NSAIDs',
      'GI risk factors documented',
      'Cardiovascular risk assessment',
      'Chronic pain condition',
    ],
    alternatives: [
      { name: 'Ibuprofen', priorAuthRequired: false, tier: 1 },
      { name: 'Meloxicam', priorAuthRequired: false, tier: 1 },
      { name: 'Diclofenac', priorAuthRequired: false, tier: 1 },
    ],
    labsRequired: ['Creatinine', 'CBC if chronic use'],
    clinicalCriteria: [
      'Inflammatory condition',
      'NSAID indicated',
      'GI protection needed',
      'No significant CV disease',
    ],
    averageApprovalTime: '1-3 business days',
    successRate: 80,
    forms: ['COX2_Inhibitor_PA'],
  },
  {
    brandName: 'Voltaren Gel',
    genericName: 'diclofenac gel',
    category: 'pain',
    commonICD10: ['M25.511', 'M17.11', 'M19.90'],
    typicalRequirements: [
      'Localized pain condition',
      'Failed oral NSAIDs or contraindicated',
      'Documented joint/muscle condition',
    ],
    alternatives: [
      { name: 'Generic diclofenac gel', priorAuthRequired: false, tier: 2 },
      { name: 'Aspercreme', priorAuthRequired: false, tier: 1, notes: 'OTC option' },
      { name: 'Oral NSAIDs', priorAuthRequired: false, tier: 1 },
    ],
    labsRequired: [],
    clinicalCriteria: [
      'Localized pain',
      'Appropriate for topical therapy',
      'No skin conditions at application site',
    ],
    averageApprovalTime: '1-2 business days',
    successRate: 85,
    forms: ['Topical_NSAID_PA'],
  },

  // ===== WEIGHT LOSS =====
  {
    brandName: 'Wegovy',
    genericName: 'semaglutide for weight',
    category: 'other',
    commonICD10: ['E66.01', 'E66.9', 'Z68.41', 'Z68.42', 'Z68.43', 'Z68.44', 'Z68.45'],
    typicalRequirements: [
      'BMI ≥ 30 OR BMI ≥ 27 with comorbidity',
      'Failed lifestyle modification (6+ months)',
      'Documented weight loss program',
      'No history of pancreatitis or MTC',
    ],
    alternatives: [
      { name: 'Phentermine', priorAuthRequired: false, tier: 2 },
      { name: 'Qsymia', priorAuthRequired: true, tier: 3 },
      { name: 'Contrave', priorAuthRequired: true, tier: 3 },
    ],
    labsRequired: ['A1C', 'Lipid panel', 'Thyroid function', 'Pregnancy test if applicable'],
    clinicalCriteria: [
      'Obesity diagnosis',
      'Failed conservative management',
      'No contraindications',
      'Committed to lifestyle changes',
    ],
    averageApprovalTime: '5-10 business days',
    successRate: 40,
    forms: ['Weight_Loss_Med_PA', 'Wegovy_Specific_Form'],
  },
  {
    brandName: 'Saxenda',
    genericName: 'liraglutide for weight',
    category: 'other',
    commonICD10: ['E66.01', 'E66.9', 'Z68.41', 'Z68.42', 'Z68.43', 'Z68.44'],
    typicalRequirements: [
      'BMI ≥ 30 OR BMI ≥ 27 with comorbidity',
      'Documented diet and exercise program',
      'No bariatric surgery planned',
      'Daily injection acceptable to patient',
    ],
    alternatives: [
      {
        name: 'Wegovy',
        generic: 'semaglutide',
        priorAuthRequired: true,
        tier: 3,
        notes: 'Weekly injection',
      },
      { name: 'Phentermine', priorAuthRequired: false, tier: 2 },
      { name: 'Orlistat', priorAuthRequired: false, tier: 2 },
    ],
    labsRequired: ['BMI calculation', 'A1C', 'Thyroid function'],
    clinicalCriteria: [
      'Obesity with complications',
      'Motivated patient',
      'No MTC or MEN 2 syndrome',
    ],
    averageApprovalTime: '3-5 business days',
    successRate: 45,
    forms: ['GLP1_Weight_Loss_PA'],
  },
];

// Helper function to find medication by name (fuzzy match)
export function findMedication(medName: string): PriorAuthMedication | undefined {
  const searchTerm = medName.toLowerCase().trim();
  return priorAuthMedications.find(
    med =>
      med.brandName.toLowerCase().includes(searchTerm) ||
      med.genericName?.toLowerCase().includes(searchTerm)
  );
}

// Get all medications in a category
export function getMedicationsByCategory(category: string): PriorAuthMedication[] {
  return priorAuthMedications.filter(med => med.category === category);
}

// Check if a medication typically needs PA
export function needsPriorAuth(medName: string): boolean {
  return findMedication(medName) !== undefined;
}
