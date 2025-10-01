/**
 * Specialty Templates for Multi-Provider Clinic
 * Supports: Endocrinology, Psychiatry, Nutrition
 */

export interface SpecialtyTemplate {
  id: string;
  name: string;
  specialty: string;
  aiPrompt: {
    role: string;
    focusAreas: string[];
    specialInstructions?: string;
  };
  corrections: {
    medications: Record<string, string>;
    terms: Record<string, string>;
    phrases: Record<string, string>;
  };
  highlightTerms: string[];
  noteSections: {
    [key: string]: {
      title: string;
      required: boolean;
      order: number;
    };
  };
  defaultProvider?: string;
}

// ============================================
// ENDOCRINOLOGY TEMPLATE
// ============================================
export const ENDOCRINOLOGY_TEMPLATE: SpecialtyTemplate = {
  id: 'endocrinology',
  name: 'Endocrinology Standard',
  specialty: 'Endocrinology',
  aiPrompt: {
    role: 'an experienced medical scribe working for an ENDOCRINOLOGIST',
    focusAreas: [
      'Diabetes management (glucose levels, A1C, insulin regimens)',
      'Thyroid disorders (TSH, T3, T4, thyroid medications)',
      'Metabolic conditions (obesity, metabolic syndrome, lipids)',
      'Hormonal imbalances (testosterone, cortisol, growth hormone)',
      'Bone metabolism (vitamin D, calcium, osteoporosis)',
      'Continuous glucose monitoring (CGM) data and pump settings',
    ],
    specialInstructions:
      'Always include specific glucose values, A1C percentages, and exact insulin doses. Note pump settings if mentioned.',
  },
  corrections: {
    medications: {
      // Insulin corrections
      lenses: 'Lantus',
      'land us': 'Lantus',
      'lance us': 'Lantus',
      'human log': 'Humalog',
      'nova log': 'NovoLog',
      tresiba: 'Tresiba',
      'to gevo': 'Toujeo',
      basaglar: 'Basaglar',
      // Diabetes medications
      metformin: 'Metformin',
      'met foreman': 'Metformin',
      ozempic: 'Ozempic',
      olympic: 'Ozempic',
      mounjaro: 'Mounjaro',
      'moon jarro': 'Mounjaro',
      jardiance: 'Jardiance',
      farxiga: 'Farxiga',
      'for ziga': 'Farxiga',
      invokana: 'Invokana',
      trulicity: 'Trulicity',
      'truly city': 'Trulicity',
      victoza: 'Victoza',
      'vic tosa': 'Victoza',
      rybelsus: 'Rybelsus',
      // Thyroid medications
      levothyroxine: 'Levothyroxine',
      'leave a thigh roxine': 'Levothyroxine',
      synthroid: 'Synthroid',
      'sin thyroid': 'Synthroid',
      'armour thyroid': 'Armour Thyroid',
      'armor thyroid': 'Armour Thyroid',
      cytomel: 'Cytomel',
      'sight a mel': 'Cytomel',
    },
    terms: {
      a1c: 'A1C',
      'a one c': 'A1C',
      'a 1 c': 'A1C',
      tsh: 'TSH',
      't s h': 'TSH',
      'free t4': 'Free T4',
      'free t 4': 'Free T4',
      'free t3': 'Free T3',
      cgm: 'CGM',
      'c g m': 'CGM',
      'flash glucose': 'flash glucose monitor',
      libre: 'FreeStyle Libre',
      dexcom: 'Dexcom',
      'decks com': 'Dexcom',
    },
    phrases: {
      'blood sugars': 'blood glucose',
      'sugars are': 'glucose levels are',
      'sugar is': 'glucose is',
      'thyroid is low': 'hypothyroid',
      'thyroid is high': 'hyperthyroid',
      'pump settings': 'insulin pump settings',
      'basal rate': 'basal rate',
      'basil rate': 'basal rate',
      'carb ratio': 'carbohydrate ratio',
    },
  },
  highlightTerms: [
    // Diabetes
    'diabetes',
    'glucose',
    'insulin',
    'A1C',
    'HbA1c',
    'hypoglycemia',
    'hyperglycemia',
    'Lantus',
    'Humalog',
    'NovoLog',
    'Metformin',
    'Ozempic',
    'Mounjaro',
    'Jardiance',
    'CGM',
    'Dexcom',
    'FreeStyle Libre',
    'ketones',
    'DKA',
    // Thyroid
    'thyroid',
    'hypothyroid',
    'hyperthyroid',
    'TSH',
    'T3',
    'T4',
    'Levothyroxine',
    'Synthroid',
    'goiter',
    'thyroiditis',
    'Hashimoto',
    // Metabolic
    'cholesterol',
    'triglycerides',
    'HDL',
    'LDL',
    'hyperlipidemia',
    'statin',
    'Lipitor',
    'Crestor',
    'metabolic syndrome',
    'PCOS',
    // Bone/Mineral
    'osteoporosis',
    'vitamin D',
    'calcium',
    'PTH',
    'bone density',
    'DEXA',
  ],
  noteSections: {
    chiefComplaint: { title: 'CHIEF COMPLAINT', required: true, order: 1 },
    historyOfPresentIllness: { title: 'HISTORY OF PRESENT ILLNESS', required: true, order: 2 },
    cgmData: { title: 'CGM/GLUCOSE DATA', required: false, order: 3 },
    reviewOfSystems: { title: 'REVIEW OF SYSTEMS', required: true, order: 4 },
    pastMedicalHistory: { title: 'PAST MEDICAL HISTORY', required: true, order: 5 },
    medications: { title: 'MEDICATIONS', required: true, order: 6 },
    allergies: { title: 'ALLERGIES', required: true, order: 7 },
    physicalExam: { title: 'PHYSICAL EXAMINATION', required: true, order: 8 },
    labs: { title: 'LABORATORY RESULTS', required: false, order: 9 },
    assessment: { title: 'ASSESSMENT', required: true, order: 10 },
    plan: { title: 'PLAN', required: true, order: 11 },
  },
  defaultProvider: 'Endocrinologist',
};

// ============================================
// PSYCHIATRY TEMPLATE
// ============================================
export const PSYCHIATRY_TEMPLATE: SpecialtyTemplate = {
  id: 'psychiatry',
  name: 'Psychiatry Standard',
  specialty: 'Psychiatry',
  aiPrompt: {
    role: 'an experienced medical scribe working for a PSYCHIATRIST',
    focusAreas: [
      'Mental status examination (appearance, mood, affect, thought process)',
      'Psychiatric symptoms (depression, anxiety, psychosis, mania)',
      'Medication management (antidepressants, antipsychotics, mood stabilizers)',
      'Risk assessment (suicidal ideation, homicidal ideation, self-harm)',
      'Substance use history (alcohol, drugs, tobacco)',
      'Sleep patterns and disturbances',
      'Psychiatric rating scales (PHQ-9, GAD-7, MADRS, YMRS)',
    ],
    specialInstructions:
      'Always document suicide risk assessment. Include specific psychiatric rating scale scores when mentioned. Note medication side effects and adherence.',
  },
  corrections: {
    medications: {
      // Antidepressants
      lexapro: 'Lexapro',
      'lex a pro': 'Lexapro',
      zoloft: 'Zoloft',
      'so loft': 'Zoloft',
      prozac: 'Prozac',
      'pro zack': 'Prozac',
      cymbalta: 'Cymbalta',
      'sim balta': 'Cymbalta',
      symbalta: 'Cymbalta',
      effexor: 'Effexor',
      'f x or': 'Effexor',
      wellbutrin: 'Wellbutrin',
      'well beauty in': 'Wellbutrin',
      pristiq: 'Pristiq',
      'pris teek': 'Pristiq',
      remeron: 'Remeron',
      'rem a ron': 'Remeron',
      // Antipsychotics
      abilify: 'Abilify',
      'a bill if i': 'Abilify',
      seroquel: 'Seroquel',
      'sarah quell': 'Seroquel',
      risperdal: 'Risperdal',
      'risp er doll': 'Risperdal',
      zyprexa: 'Zyprexa',
      'zi prex a': 'Zyprexa',
      geodon: 'Geodon',
      'geo don': 'Geodon',
      latuda: 'Latuda',
      'la too da': 'Latuda',
      vraylar: 'Vraylar',
      clozapine: 'Clozapine',
      'close a peen': 'Clozapine',
      // Mood stabilizers
      lithium: 'Lithium',
      depakote: 'Depakote',
      'deep a coat': 'Depakote',
      lamictal: 'Lamictal',
      'lam ick tall': 'Lamictal',
      trileptal: 'Trileptal',
      'try lep tall': 'Trileptal',
      // Anxiety/Sleep
      xanax: 'Xanax',
      'zan ax': 'Xanax',
      ativan: 'Ativan',
      'at ivan': 'Ativan',
      klonopin: 'Klonopin',
      'clone a pin': 'Klonopin',
      valium: 'Valium',
      ambien: 'Ambien',
      'am bee in': 'Ambien',
      lunesta: 'Lunesta',
      trazodone: 'Trazodone',
      'trays a done': 'Trazodone',
    },
    terms: {
      phq9: 'PHQ-9',
      'phq 9': 'PHQ-9',
      gad7: 'GAD-7',
      'gad 7': 'GAD-7',
      si: 'suicidal ideation',
      's i': 'suicidal ideation',
      hi: 'homicidal ideation',
      mse: 'mental status exam',
      'm s e': 'mental status exam',
      adhd: 'ADHD',
      'a d h d': 'ADHD',
      ptsd: 'PTSD',
      'p t s d': 'PTSD',
      ocd: 'OCD',
      'o c d': 'OCD',
      bipolar: 'bipolar disorder',
      'bi polar': 'bipolar disorder',
    },
    phrases: {
      'feels depressed': 'reports depression',
      'feels anxious': 'reports anxiety',
      'cant sleep': "can't sleep",
      'sleeping too much': 'hypersomnia',
      'sleeping too little': 'insomnia',
      'hearing voices': 'auditory hallucinations',
      'seeing things': 'visual hallucinations',
      'wants to die': 'suicidal ideation',
      'wants to hurt': 'homicidal ideation',
      'panic attacks': 'panic attacks',
      'mood swings': 'mood lability',
    },
  },
  highlightTerms: [
    // Conditions
    'depression',
    'anxiety',
    'bipolar',
    'schizophrenia',
    'PTSD',
    'ADHD',
    'OCD',
    'panic disorder',
    'GAD',
    'MDD',
    'psychosis',
    'mania',
    'hypomania',
    // Symptoms
    'suicidal ideation',
    'homicidal ideation',
    'hallucinations',
    'delusions',
    'paranoia',
    'insomnia',
    'hypersomnia',
    'anhedonia',
    'anergia',
    // Medications
    'Lexapro',
    'Zoloft',
    'Prozac',
    'Cymbalta',
    'Wellbutrin',
    'Abilify',
    'Seroquel',
    'Risperdal',
    'Lithium',
    'Depakote',
    'Lamictal',
    // Scales
    'PHQ-9',
    'GAD-7',
    'MADRS',
    'YMRS',
    'PANSS',
    // Other
    'mental status exam',
    'cognitive',
    'affect',
    'mood',
  ],
  noteSections: {
    chiefComplaint: { title: 'CHIEF COMPLAINT', required: true, order: 1 },
    historyOfPresentIllness: { title: 'HISTORY OF PRESENT ILLNESS', required: true, order: 2 },
    psychiatricHistory: { title: 'PSYCHIATRIC HISTORY', required: true, order: 3 },
    substanceUse: { title: 'SUBSTANCE USE HISTORY', required: true, order: 4 },
    mentalStatusExam: { title: 'MENTAL STATUS EXAMINATION', required: true, order: 5 },
    medications: { title: 'MEDICATIONS', required: true, order: 6 },
    allergies: { title: 'ALLERGIES', required: true, order: 7 },
    riskAssessment: { title: 'RISK ASSESSMENT', required: true, order: 8 },
    assessment: { title: 'ASSESSMENT', required: true, order: 9 },
    plan: { title: 'PLAN', required: true, order: 10 },
  },
  defaultProvider: 'Psychiatrist',
};

// ============================================
// NUTRITION TEMPLATE
// ============================================
export const NUTRITION_TEMPLATE: SpecialtyTemplate = {
  id: 'nutrition',
  name: 'Nutrition Standard',
  specialty: 'Nutrition',
  aiPrompt: {
    role: 'an experienced medical scribe working for a CLINICAL NUTRITIONIST',
    focusAreas: [
      'Dietary assessment (24-hour recall, food frequency)',
      'Nutritional status (BMI, body composition, malnutrition screening)',
      'Macronutrient distribution (carbohydrates, proteins, fats)',
      'Micronutrient deficiencies (vitamins, minerals)',
      'Medical nutrition therapy for chronic diseases',
      'Eating behaviors and patterns',
      'Food allergies and intolerances',
      'Supplement usage and recommendations',
    ],
    specialInstructions:
      'Focus on specific food intake, portion sizes, meal timing, and nutritional goals. Include BMI calculations and caloric needs when discussed.',
  },
  corrections: {
    medications: {
      // Supplements
      'vitamin d': 'Vitamin D',
      'vitamin d3': 'Vitamin D3',
      'vitamin b12': 'Vitamin B12',
      'b 12': 'B12',
      'vitamin b complex': 'Vitamin B Complex',
      'omega 3': 'Omega-3',
      'omega three': 'Omega-3',
      'fish oil': 'fish oil',
      probiotics: 'probiotics',
      'pro biotics': 'probiotics',
      multivitamin: 'multivitamin',
      'multi vitamin': 'multivitamin',
      calcium: 'calcium',
      magnesium: 'magnesium',
      iron: 'iron',
      'folic acid': 'folic acid',
      folate: 'folate',
      coq10: 'CoQ10',
      'co q 10': 'CoQ10',
      glucosamine: 'glucosamine',
      'glue cosa mean': 'glucosamine',
      'protein powder': 'protein powder',
      'whey protein': 'whey protein',
      'way protein': 'whey protein',
      ensure: 'Ensure',
      boost: 'Boost',
    },
    terms: {
      bmi: 'BMI',
      'b m i': 'BMI',
      rdl: 'RDA',
      'r d a': 'RDA',
      dri: 'DRI',
      'd r i': 'DRI',
      calories: 'calories',
      kcal: 'kcal',
      carbs: 'carbohydrates',
      protein: 'protein',
      'pro teen': 'protein',
      fat: 'fat',
      fiber: 'fiber',
      'glycemic index': 'glycemic index',
      gluten: 'gluten',
      'glue ten': 'gluten',
      lactose: 'lactose',
      'lack toes': 'lactose',
      fodmap: 'FODMAP',
      'fod map': 'FODMAP',
    },
    phrases: {
      'eating habits': 'dietary patterns',
      'food diary': 'food record',
      'meal plan': 'nutrition plan',
      'weight loss': 'weight reduction',
      'weight gain': 'weight gain',
      'build muscle': 'increase lean body mass',
      'cut carbs': 'reduce carbohydrate intake',
      'low carb': 'low carbohydrate',
      'high protein': 'high protein',
      'plant based': 'plant-based',
      'portion control': 'portion control',
      'mindful eating': 'mindful eating',
      'emotional eating': 'emotional eating',
    },
  },
  highlightTerms: [
    // Measurements
    'BMI',
    'weight',
    'height',
    'body fat',
    'muscle mass',
    'waist circumference',
    // Nutrients
    'calories',
    'carbohydrates',
    'protein',
    'fat',
    'fiber',
    'sugar',
    'sodium',
    'cholesterol',
    'saturated fat',
    'trans fat',
    // Vitamins/Minerals
    'Vitamin D',
    'B12',
    'iron',
    'calcium',
    'folate',
    'Omega-3',
    // Conditions
    'obesity',
    'malnutrition',
    'diabetes',
    'hypertension',
    'celiac',
    'IBS',
    'GERD',
    'food allergy',
    'lactose intolerance',
    // Diets
    'Mediterranean',
    'DASH',
    'ketogenic',
    'vegan',
    'vegetarian',
    'gluten-free',
    'low-FODMAP',
    'paleo',
  ],
  noteSections: {
    chiefComplaint: { title: 'REASON FOR VISIT', required: true, order: 1 },
    currentDiet: { title: 'CURRENT DIETARY INTAKE', required: true, order: 2 },
    nutritionalAssessment: { title: 'NUTRITIONAL ASSESSMENT', required: true, order: 3 },
    anthropometrics: { title: 'ANTHROPOMETRIC DATA', required: true, order: 4 },
    biochemicalData: { title: 'BIOCHEMICAL DATA', required: false, order: 5 },
    medicalHistory: { title: 'RELEVANT MEDICAL HISTORY', required: true, order: 6 },
    medications: { title: 'MEDICATIONS & SUPPLEMENTS', required: true, order: 7 },
    foodAllergies: { title: 'FOOD ALLERGIES/INTOLERANCES', required: true, order: 8 },
    assessment: { title: 'NUTRITION DIAGNOSIS', required: true, order: 9 },
    plan: { title: 'NUTRITION INTERVENTION PLAN', required: true, order: 10 },
    goals: { title: 'GOALS & FOLLOW-UP', required: true, order: 11 },
  },
  defaultProvider: 'Clinical Nutritionist, RD',
};

// ============================================
// TEMPLATE REGISTRY
// ============================================
export const SPECIALTY_TEMPLATES = {
  endocrinology: ENDOCRINOLOGY_TEMPLATE,
  psychiatry: PSYCHIATRY_TEMPLATE,
  nutrition: NUTRITION_TEMPLATE,
};

// Helper function to get template by specialty
export function getTemplateBySpecialty(specialty: string): SpecialtyTemplate {
  const normalizedSpecialty = specialty.toLowerCase();

  // Map various specialty names to our templates
  const specialtyMap: Record<string, string> = {
    endocrinology: 'endocrinology',
    endocrine: 'endocrinology',
    diabetes: 'endocrinology',
    psychiatry: 'psychiatry',
    psychiatric: 'psychiatry',
    'mental health': 'psychiatry',
    'behavioral health': 'psychiatry',
    nutrition: 'nutrition',
    dietitian: 'nutrition',
    nutritionist: 'nutrition',
    dietetics: 'nutrition',
  };

  const templateKey = specialtyMap[normalizedSpecialty] || 'endocrinology'; // Default to endocrinology
  return SPECIALTY_TEMPLATES[templateKey as keyof typeof SPECIALTY_TEMPLATES];
}

// Get list of available specialties for dropdown
export function getAvailableSpecialties(): Array<{ value: string; label: string }> {
  return [
    { value: 'endocrinology', label: 'Endocrinology' },
    { value: 'psychiatry', label: 'Psychiatry' },
    { value: 'nutrition', label: 'Nutrition/Dietetics' },
  ];
}
