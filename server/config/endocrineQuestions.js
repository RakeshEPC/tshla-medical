/**
 * Endocrine Question Library
 * Defines condition-specific questions for adaptive pre-visit calling
 * Each condition has a set of focused questions that take ~1-2 minutes
 */

const endocrineQuestions = {
  /**
   * TYPE 2 DIABETES
   */
  'diabetes': {
    displayName: 'Type 2 Diabetes',
    keywords: ['diabetes', 'dm2', 't2dm', 'type 2 dm', 'diabetic'],
    questions: [
      {
        id: 'diabetes_meds',
        question: 'Are you taking all your diabetes medications as prescribed?',
        type: 'boolean',
        followUp: {
          true: null,
          false: 'Which medication did you stop or change?'
        }
      },
      {
        id: 'diabetes_control',
        question: 'How are your blood sugars running?',
        type: 'open_ended',
        followUp: 'Are you checking with a glucose meter or continuous sensor?'
      },
      {
        id: 'diabetes_labs',
        question: 'When was your last A1C checked?',
        type: 'timeframe',
        options: ['Within last month', '1-3 months ago', '3+ months ago', 'Don\'t remember']
      }
    ],
    dataStructure: {
      medications_compliant: 'boolean',
      medication_changes: 'string',
      glucose_control: 'string',
      monitoring_method: 'string',
      last_a1c: 'string'
    }
  },

  /**
   * HYPOTHYROIDISM
   */
  'hypothyroidism': {
    displayName: 'Hypothyroidism',
    keywords: ['hypothyroid', 'low thyroid', 'hashimoto', 'thyroid'],
    questions: [
      {
        id: 'thyroid_meds',
        question: 'Are you taking your levothyroxine every day?',
        type: 'boolean',
        followUp: {
          true: 'What dose are you taking?',
          false: 'When did you stop taking it?'
        }
      },
      {
        id: 'thyroid_symptoms',
        question: 'Any fatigue, weight changes, or feeling cold?',
        type: 'open_ended'
      },
      {
        id: 'thyroid_labs',
        question: 'When was your last TSH checked?',
        type: 'timeframe',
        options: ['Within last month', '1-3 months ago', '3-6 months ago', '6+ months ago', 'Don\'t remember']
      }
    ],
    dataStructure: {
      medication_compliant: 'boolean',
      levothyroxine_dose: 'string',
      symptoms: 'string',
      last_tsh: 'string'
    }
  },

  /**
   * HYPERTHYROIDISM
   */
  'hyperthyroidism': {
    displayName: 'Hyperthyroidism',
    keywords: ['hyperthyroid', 'graves', 'thyrotoxicosis'],
    questions: [
      {
        id: 'hyperthyroid_meds',
        question: 'Are you taking your methimazole or PTU?',
        type: 'boolean',
        followUp: {
          true: 'What dose?',
          false: null
        }
      },
      {
        id: 'hyperthyroid_symptoms',
        question: 'Any heart racing, anxiety, tremors, or weight loss?',
        type: 'open_ended'
      },
      {
        id: 'hyperthyroid_labs',
        question: 'When was your last TSH checked?',
        type: 'timeframe'
      }
    ],
    dataStructure: {
      medication_compliant: 'boolean',
      medication_dose: 'string',
      symptoms: 'string',
      last_tsh: 'string'
    }
  },

  /**
   * LOW TESTOSTERONE
   */
  'testosterone': {
    displayName: 'Low Testosterone',
    keywords: ['testosterone', 'hypogonadism', 'low t', 'testicular hypofunction'],
    questions: [
      {
        id: 'testosterone_meds',
        question: 'Are you using your testosterone gel or injections?',
        type: 'boolean',
        followUp: {
          true: 'What dose and how often?',
          false: null
        }
      },
      {
        id: 'testosterone_response',
        question: 'Any improvement in energy, mood, or libido?',
        type: 'open_ended'
      },
      {
        id: 'testosterone_labs',
        question: 'When was your last testosterone level checked?',
        type: 'timeframe'
      }
    ],
    dataStructure: {
      medication_compliant: 'boolean',
      medication_dose: 'string',
      medication_frequency: 'string',
      symptom_improvement: 'string',
      last_level: 'string'
    }
  },

  /**
   * OSTEOPOROSIS / OSTEOPENIA
   */
  'osteoporosis': {
    displayName: 'Osteoporosis',
    keywords: ['osteoporosis', 'osteopenia', 'bone density', 'low bone'],
    questions: [
      {
        id: 'osteo_injection',
        question: 'When was your last bone density injection like Prolia or Reclast?',
        type: 'timeframe'
      },
      {
        id: 'osteo_supplements',
        question: 'Are you taking calcium and vitamin D?',
        type: 'boolean',
        followUp: {
          true: 'What doses?',
          false: null
        }
      },
      {
        id: 'osteo_falls',
        question: 'Any falls or fractures since your last visit?',
        type: 'boolean',
        followUp: {
          true: 'Tell me what happened',
          false: null
        }
      }
    ],
    dataStructure: {
      last_injection_date: 'string',
      last_injection_type: 'string',
      taking_supplements: 'boolean',
      calcium_dose: 'string',
      vitamin_d_dose: 'string',
      falls: 'boolean',
      fall_details: 'string'
    }
  },

  /**
   * PCOS (Polycystic Ovary Syndrome)
   */
  'pcos': {
    displayName: 'PCOS',
    keywords: ['pcos', 'polycystic ovary', 'polycystic'],
    questions: [
      {
        id: 'pcos_meds',
        question: 'Are you taking metformin, spironolactone, or birth control?',
        type: 'open_ended'
      },
      {
        id: 'pcos_cycles',
        question: 'Any changes in your menstrual cycle?',
        type: 'open_ended'
      },
      {
        id: 'pcos_labs',
        question: 'When was your last hormone panel checked?',
        type: 'timeframe'
      }
    ],
    dataStructure: {
      current_medications: 'string',
      cycle_changes: 'string',
      last_labs: 'string'
    }
  },

  /**
   * ADRENAL INSUFFICIENCY
   */
  'adrenal': {
    displayName: 'Adrenal Insufficiency',
    keywords: ['adrenal insufficiency', 'addison', 'adrenal'],
    questions: [
      {
        id: 'adrenal_meds',
        question: 'Are you taking your hydrocortisone every day?',
        type: 'boolean',
        followUp: {
          true: 'What times do you take it?',
          false: null
        }
      },
      {
        id: 'adrenal_symptoms',
        question: 'Any dizziness, nausea, or extreme fatigue?',
        type: 'open_ended'
      },
      {
        id: 'adrenal_labs',
        question: 'When was your last cortisol or ACTH level checked?',
        type: 'timeframe'
      }
    ],
    dataStructure: {
      medication_compliant: 'boolean',
      dosing_schedule: 'string',
      symptoms: 'string',
      last_labs: 'string'
    }
  },

  /**
   * CUSHING'S SYNDROME
   */
  'cushings': {
    displayName: 'Cushing\'s Syndrome',
    keywords: ['cushing', 'hypercortisolism'],
    questions: [
      {
        id: 'cushings_meds',
        question: 'Are you taking any medications to lower cortisol?',
        type: 'open_ended'
      },
      {
        id: 'cushings_symptoms',
        question: 'Any changes in weight, blood pressure, or blood sugar?',
        type: 'open_ended'
      },
      {
        id: 'cushings_labs',
        question: 'When were your last cortisol levels checked?',
        type: 'timeframe'
      }
    ],
    dataStructure: {
      current_medications: 'string',
      symptoms: 'string',
      last_labs: 'string'
    }
  },

  /**
   * VITAMIN D DEFICIENCY
   */
  'vitamin_d': {
    displayName: 'Vitamin D Deficiency',
    keywords: ['vitamin d', 'vit d', 'vitamin d deficiency'],
    questions: [
      {
        id: 'vitd_supplement',
        question: 'Are you taking your vitamin D supplement?',
        type: 'boolean',
        followUp: {
          true: 'What dose?',
          false: null
        }
      },
      {
        id: 'vitd_labs',
        question: 'When was your last vitamin D level checked?',
        type: 'timeframe'
      }
    ],
    dataStructure: {
      taking_supplement: 'boolean',
      dose: 'string',
      last_level: 'string'
    }
  }
};

/**
 * Universal questions asked to ALL patients regardless of condition
 */
const universalQuestions = [
  {
    id: 'refills',
    question: 'What prescription refills do you need today?',
    type: 'list'
  },
  {
    id: 'concerns',
    question: 'What concerns or questions do you have for the doctor?',
    type: 'open_ended'
  }
];

/**
 * Map patient conditions to question sets
 * @param {Array<string>} conditions - Patient's condition list
 * @returns {Array<string>} Question set keys to use
 */
function mapConditionsToQuestionSets(conditions) {
  const questionSets = new Set();

  conditions.forEach(condition => {
    const lowerCondition = condition.toLowerCase();

    // Check each question set's keywords
    for (const [key, config] of Object.entries(endocrineQuestions)) {
      const matches = config.keywords.some(keyword =>
        lowerCondition.includes(keyword.toLowerCase())
      );

      if (matches) {
        questionSets.add(key);
      }
    }
  });

  return Array.from(questionSets);
}

/**
 * Get all questions for a patient based on their conditions
 * @param {Array<string>} conditions - Patient's conditions
 * @returns {Object} Organized questions by condition
 */
function getQuestionsForPatient(conditions) {
  const questionSetKeys = mapConditionsToQuestionSets(conditions);

  const conditionQuestions = {};
  questionSetKeys.forEach(key => {
    conditionQuestions[key] = endocrineQuestions[key];
  });

  return {
    conditions: conditionQuestions,
    universal: universalQuestions
  };
}

module.exports = {
  endocrineQuestions,
  universalQuestions,
  mapConditionsToQuestionSets,
  getQuestionsForPatient
};
