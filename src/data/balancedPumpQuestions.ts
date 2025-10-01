// Balanced PumpDrive Questionnaire - Strategic 8-10 Questions
// Replaces overwhelming 54 open-ended questions with focused, actionable ones

export type QuestionType = 'multiple_choice' | 'scale' | 'checkbox' | 'conditional' | 'scenario';

export interface QuestionOption {
  value: string;
  label: string;
  followUp?: string[]; // Triggers additional questions
  weight?: Record<string, number>; // Scoring weights for different pump features
}

export interface BalancedQuestion {
  id: string;
  type: QuestionType;
  phase: 'core' | 'refinement' | 'advanced'; // Progressive disclosure phases
  category: string;
  title: string;
  description?: string;
  required: boolean;
  options: QuestionOption[];
  skipOption: {
    label: string;
    value: string;
  };
  timeEstimate: number; // seconds
  impactWeight: number; // How much this affects recommendations (1-10)
}

export const BALANCED_PUMP_QUESTIONS: BalancedQuestion[] = [
  // CORE PHASE QUESTIONS (8 questions, 4-5 minutes)

  // 1. Primary Priority (High Impact)
  {
    id: 'primary_priority',
    type: 'multiple_choice',
    phase: 'core',
    category: 'priorities',
    title: 'What matters most to you in a pump?',
    description: 'This helps us focus on your top priority',
    required: true,
    options: [
      {
        value: 'simplicity',
        label: '🎯 Simplest setup and daily use',
        weight: { automation: 8, simplicity: 10, cost: 6 },
      },
      {
        value: 'technology',
        label: '🚀 Best technology and control features',
        weight: { features: 10, automation: 9, integration: 8 },
      },
      {
        value: 'cost',
        label: '💰 Lowest total cost (device + supplies)',
        weight: { cost: 10, simplicity: 7, basic_features: 8 },
      },
      {
        value: 'lifestyle',
        label: '🏃 Best fit for my active lifestyle',
        weight: { durability: 9, discretion: 8, waterproof: 9 },
      },
    ],
    skipOption: { label: 'Not sure yet', value: 'skip' },
    timeEstimate: 45,
    impactWeight: 10,
  },

  // 2. Form Factor Preference (High Impact)
  {
    id: 'form_factor',
    type: 'multiple_choice',
    phase: 'core',
    category: 'design',
    title: 'Which pump design appeals to you?',
    description: "Think about what you'd be comfortable wearing daily",
    required: false,
    options: [
      {
        value: 'tubeless',
        label: '📱 Tubeless patch pump (like a large bandage)',
        weight: { tubeless: 10, discretion: 7, swimming: 10 },
      },
      {
        value: 'tubing',
        label: '📞 Traditional pump with tubing',
        weight: { traditional: 10, reliability: 8, options: 9 },
      },
      {
        value: 'either',
        label: '🤷 Either works for me',
        weight: { tubeless: 5, traditional: 5 },
      },
    ],
    skipOption: { label: 'Show me both types', value: 'skip' },
    timeEstimate: 30,
    impactWeight: 9,
  },

  // 3. Technology Comfort Level (High Impact)
  {
    id: 'tech_comfort',
    type: 'scale',
    phase: 'core',
    category: 'technology',
    title: 'How comfortable are you with new technology?',
    description: 'Be honest - this helps us match complexity to your preferences',
    required: false,
    options: [
      {
        value: 'low',
        label: '1-3: I prefer simple, fewer tech features',
        weight: { simplicity: 9, basic_features: 8, support: 9 },
      },
      {
        value: 'medium',
        label: "4-6: I'm comfortable with moderate tech",
        weight: { moderate_features: 8, learning: 7 },
      },
      {
        value: 'high',
        label: '7-10: I love advanced features and customization',
        weight: { advanced_features: 10, customization: 9, integration: 8 },
      },
    ],
    skipOption: { label: 'Depends on the specific feature', value: 'skip' },
    timeEstimate: 30,
    impactWeight: 8,
  },

  // 4. Budget Reality Check (Medium Impact)
  {
    id: 'budget_reality',
    type: 'multiple_choice',
    phase: 'core',
    category: 'cost',
    title: "What's your biggest cost concern?",
    description: 'Help us understand your financial priorities',
    required: false,
    options: [
      {
        value: 'upfront',
        label: '💵 High upfront device cost',
        weight: { low_upfront: 9, basic_model: 7 },
      },
      {
        value: 'ongoing',
        label: '📦 Monthly supply costs',
        weight: { efficient_supplies: 9, longer_wear: 8 },
      },
      {
        value: 'insurance',
        label: '🏥 Insurance coverage limitations',
        weight: { insurance_friendly: 10, standard_options: 8 },
      },
      {
        value: 'not_concerned',
        label: "✨ Cost isn't my main concern",
        weight: { premium_features: 7, latest_tech: 6 },
      },
    ],
    skipOption: { label: 'Prefer not to discuss finances', value: 'skip' },
    timeEstimate: 30,
    impactWeight: 7,
  },

  // 5. Control Philosophy (High Impact)
  {
    id: 'control_philosophy',
    type: 'scenario',
    phase: 'core',
    category: 'control',
    title: "At 3 AM, your glucose trends slightly high. You'd prefer:",
    description: 'This tells us about your automation comfort level',
    required: false,
    options: [
      {
        value: 'full_auto',
        label: '😴 System handles it automatically while I sleep',
        weight: { automation: 10, closed_loop: 9 },
      },
      {
        value: 'alert_auto',
        label: "🔔 Gentle alert, then system adjusts if I don't respond",
        weight: { hybrid_automation: 9, alerts: 7 },
      },
      {
        value: 'wake_me',
        label: '⏰ Wake me up so I can decide what to do',
        weight: { manual_control: 8, alerts: 10 },
      },
      {
        value: 'alert_only',
        label: '📱 Just alert me, no automatic adjustments',
        weight: { manual_control: 10, basic_alerts: 8 },
      },
    ],
    skipOption: { label: "I'm not sure about this scenario", value: 'skip' },
    timeEstimate: 45,
    impactWeight: 9,
  },

  // 6. Activity Level Assessment (Medium Impact)
  {
    id: 'activity_level',
    type: 'multiple_choice',
    phase: 'core',
    category: 'lifestyle',
    title: 'How would you describe your physical activity?',
    description: 'Helps us recommend pumps that fit your lifestyle',
    required: false,
    options: [
      {
        value: 'very_active',
        label: '🏋️ Very active (sports, gym, swimming regularly)',
        weight: { waterproof: 10, durability: 9, temp_basal: 8 },
        followUp: ['swimming_frequency', 'sport_types'],
      },
      {
        value: 'moderately_active',
        label: '🚶 Moderately active (regular walks, occasional activities)',
        weight: { durability: 6, temp_basal: 6 },
      },
      {
        value: 'less_active',
        label: '🏠 Less active (mostly desk work, light activities)',
        weight: { compact: 7, discretion: 8 },
      },
      {
        value: 'varies',
        label: '📅 It varies significantly week to week',
        weight: { flexibility: 8, temp_basal: 7 },
      },
    ],
    skipOption: { label: "Activity level isn't important to me", value: 'skip' },
    timeEstimate: 30,
    impactWeight: 6,
  },

  // 7. Discretion Needs (Medium Impact)
  {
    id: 'discretion_needs',
    type: 'multiple_choice',
    phase: 'core',
    category: 'lifestyle',
    title: 'How important is it that your pump is discreet?',
    description: 'Consider work, social situations, and personal comfort',
    required: false,
    options: [
      {
        value: 'very_important',
        label: '🤫 Very important - must be hidden/low profile',
        weight: { discretion: 10, compact: 9, tubeless: 7 },
      },
      {
        value: 'somewhat_important',
        label: '👔 Somewhat important - prefer subtle',
        weight: { discretion: 7, compact: 6 },
      },
      {
        value: 'not_important',
        label: '🤷 Not important - function over form',
        weight: { functionality: 8, features: 7 },
      },
      {
        value: 'prefer_visible',
        label: '👁️ Actually prefer it visible for safety/medical ID',
        weight: { visibility: 8, safety_features: 7 },
      },
    ],
    skipOption: { label: "Haven't thought about this", value: 'skip' },
    timeEstimate: 30,
    impactWeight: 6,
  },

  // 8. Support Preferences (Medium Impact)
  {
    id: 'support_style',
    type: 'multiple_choice',
    phase: 'core',
    category: 'support',
    title: 'When learning something new and complex, you prefer:',
    description: 'This helps us recommend pumps with the right support resources',
    required: false,
    options: [
      {
        value: 'hands_on',
        label: '🤝 In-person training with a specialist',
        weight: { clinic_support: 9, training_programs: 8 },
      },
      {
        value: 'self_directed',
        label: '📚 Self-directed with good written materials/videos',
        weight: { documentation: 8, video_resources: 7 },
      },
      {
        value: 'phone_support',
        label: '📞 Phone support when I have questions',
        weight: { phone_support: 9, availability: 8 },
      },
      {
        value: 'trial_error',
        label: '🔧 Figure it out myself through trial and error',
        weight: { simple_design: 8, intuitive: 9 },
      },
    ],
    skipOption: { label: 'Depends on the complexity', value: 'skip' },
    timeEstimate: 30,
    impactWeight: 5,
  },

  // REFINEMENT PHASE QUESTIONS (Optional, based on core answers)

  // 9. Insurance Flexibility (Conditional - only if budget_reality != 'not_concerned')
  {
    id: 'insurance_flexibility',
    type: 'scale',
    phase: 'refinement',
    category: 'cost',
    title: 'How flexible is your insurance with pump choices?',
    description: 'Only appears if cost is a concern',
    required: false,
    options: [
      {
        value: 'very_limited',
        label: '1-2: Very limited - specific brands only',
        weight: { insurance_preferred: 10, standard_options: 9 },
      },
      {
        value: 'somewhat_limited',
        label: '3-4: Somewhat limited options',
        weight: { insurance_friendly: 8, common_brands: 7 },
      },
      {
        value: 'flexible',
        label: '5: Very flexible - most pumps covered',
        weight: { premium_options: 6, latest_models: 5 },
      },
    ],
    skipOption: { label: "I don't know my coverage details", value: 'skip' },
    timeEstimate: 30,
    impactWeight: 7,
  },

  // 10. Advanced Feature Interest (Conditional - only if tech_comfort = 'high')
  {
    id: 'advanced_features',
    type: 'checkbox',
    phase: 'refinement',
    category: 'features',
    title: 'Which advanced features interest you most?',
    description: 'Select all that appeal to you',
    required: false,
    options: [
      {
        value: 'smartphone_control',
        label: '📱 Full smartphone app control',
        weight: { app_control: 9, connectivity: 8 },
      },
      {
        value: 'data_analysis',
        label: '📊 Detailed data analysis and trends',
        weight: { analytics: 9, reporting: 8 },
      },
      {
        value: 'integration',
        label: '🔗 Integration with other health apps',
        weight: { integration: 10, ecosystem: 8 },
      },
      {
        value: 'customization',
        label: '⚙️ Extensive customization options',
        weight: { customization: 10, advanced_settings: 9 },
      },
    ],
    skipOption: { label: 'None of these matter to me', value: 'skip' },
    timeEstimate: 45,
    impactWeight: 4,
  },

  // ADVANCED PHASE QUESTIONS (Optional deep dive)

  // 11. Meal Management Style (Advanced)
  {
    id: 'meal_management',
    type: 'multiple_choice',
    phase: 'advanced',
    category: 'control',
    title: 'How do you typically handle meal dosing?',
    required: false,
    options: [
      {
        value: 'precise_counting',
        label: '🔢 I count carbs precisely and like detailed control',
        weight: { precision_dosing: 9, carb_ratios: 8 },
      },
      {
        value: 'estimated_dosing',
        label: '🤷 I prefer simple/estimated dosing',
        weight: { simple_dosing: 8, preset_meals: 7 },
      },
      {
        value: 'automation',
        label: '🤖 I want automation to help with meal decisions',
        weight: { meal_automation: 9, ai_assistance: 8 },
      },
    ],
    skipOption: { label: 'My meal patterns are too irregular', value: 'skip' },
    timeEstimate: 30,
    impactWeight: 3,
  },

  // 12. Alert Preferences (Advanced)
  {
    id: 'alert_preferences',
    type: 'multiple_choice',
    phase: 'advanced',
    category: 'control',
    title: 'During a busy workday, pump alerts should:',
    required: false,
    options: [
      {
        value: 'urgent_only',
        label: '🚨 Only for urgent situations',
        weight: { minimal_alerts: 9, urgent_only: 8 },
      },
      {
        value: 'helpful_reminders',
        label: '💡 Include helpful reminders',
        weight: { moderate_alerts: 7, reminders: 8 },
      },
      {
        value: 'comprehensive',
        label: '📋 Comprehensive feedback and data',
        weight: { detailed_alerts: 8, full_feedback: 9 },
      },
      {
        value: 'customizable',
        label: '⚙️ Customizable by time/situation',
        weight: { customizable_alerts: 10, smart_alerts: 9 },
      },
    ],
    skipOption: { label: "I haven't thought about this", value: 'skip' },
    timeEstimate: 30,
    impactWeight: 3,
  },
];

// Express Mode - Ultra Quick (3 questions, 2 minutes)
export const EXPRESS_QUESTIONS: BalancedQuestion[] = [
  BALANCED_PUMP_QUESTIONS[0], // Primary priority
  BALANCED_PUMP_QUESTIONS[1], // Form factor
  BALANCED_PUMP_QUESTIONS[4], // Control philosophy
];

// Question flow logic
export const QUESTION_FLOW = {
  core: BALANCED_PUMP_QUESTIONS.filter(q => q.phase === 'core'),
  refinement: BALANCED_PUMP_QUESTIONS.filter(q => q.phase === 'refinement'),
  advanced: BALANCED_PUMP_QUESTIONS.filter(q => q.phase === 'advanced'),
  express: EXPRESS_QUESTIONS,
};

// Conditional logic for showing refinement questions
export const REFINEMENT_CONDITIONS = {
  insurance_flexibility: (answers: Record<string, string>) =>
    answers.budget_reality && answers.budget_reality !== 'not_concerned',

  advanced_features: (answers: Record<string, string>) => answers.tech_comfort === 'high',
};

// Scoring weights for pump recommendations
export const PUMP_SCORING_WEIGHTS = {
  // Omnipod 5
  omnipod_5: {
    tubeless: 10,
    automation: 9,
    waterproof: 10,
    discretion: 7,
    simplicity: 8,
    cost: 6,
  },

  // Tandem t:slim X2
  tandem_tslim: {
    traditional: 9,
    features: 10,
    customization: 9,
    integration: 10,
    precision_dosing: 9,
    cost: 7,
  },

  // Medtronic 780G
  medtronic_780g: {
    automation: 10,
    traditional: 8,
    insurance_friendly: 9,
    clinic_support: 10,
    reliability: 9,
    cost: 8,
  },
};

export default BALANCED_PUMP_QUESTIONS;
