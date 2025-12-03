/**
 * DTSQs (Diabetes Treatment Satisfaction Questionnaire - Status Version)
 *
 * Licensed to: Dr Rakesh Patel MD (licence ref CB1744)
 * Copyright: © 1983 Health Psychology Research Ltd.
 * English for USA (rev. 31.7.94)
 *
 * These are the exact questions from the official DTSQs questionnaire.
 * DO NOT modify question text without proper licensing approval.
 */

export interface DTSQsQuestion {
  id: string; // Matches DTSQsResponse field names
  number: number; // Question number (1-8)
  question: string; // Question text (exact from official form)
  leftLabel: string; // Label for highest value (6)
  rightLabel: string; // Label for lowest value (0)
  leftValue: number; // Always 6
  rightValue: number; // Always 0
  inverted: boolean; // If true, higher score = worse (Q2, Q3)
  helpText?: string; // Additional context for users
  clinicalNote?: string; // Internal note for interpretation
}

export const DTSQS_QUESTIONS: DTSQsQuestion[] = [
  {
    id: 'q1_treatment_satisfaction',
    number: 1,
    question: 'How satisfied are you with your current treatment?',
    leftLabel: 'very satisfied',
    rightLabel: 'very dissatisfied',
    leftValue: 6,
    rightValue: 0,
    inverted: false,
    helpText: 'Consider your overall experience with monitoring, insulin, tablets, and diet.',
    clinicalNote: 'Primary satisfaction indicator - low scores suggest readiness for change'
  },
  {
    id: 'q2_high_blood_sugars',
    number: 2,
    question: 'How often have you felt that your blood sugars have been unacceptably high recently?',
    leftLabel: 'most of the time',
    rightLabel: 'none of the time',
    leftValue: 6,
    rightValue: 0,
    inverted: true, // Higher score = worse control
    helpText: 'Think about the past few weeks. High blood sugars might make you feel tired, thirsty, or need to urinate frequently.',
    clinicalNote: 'High scores indicate need for more aggressive algorithm (Medtronic 780G)'
  },
  {
    id: 'q3_low_blood_sugars',
    number: 3,
    question: 'How often have you felt that your blood sugars have been unacceptably low recently?',
    leftLabel: 'most of the time',
    rightLabel: 'none of the time',
    leftValue: 6,
    rightValue: 0,
    inverted: true, // Higher score = worse control
    helpText: 'Low blood sugars (hypoglycemia) might cause shakiness, sweating, confusion, or anxiety.',
    clinicalNote: 'High scores indicate need for conservative algorithm with better low protection'
  },
  {
    id: 'q4_convenience',
    number: 4,
    question: 'How convenient have you been finding your treatment to be recently?',
    leftLabel: 'very convenient',
    rightLabel: 'very inconvenient',
    leftValue: 6,
    rightValue: 0,
    inverted: false,
    helpText: 'Consider how easy it is to fit your diabetes management into your daily life.',
    clinicalNote: 'Low scores suggest need for tubeless (Omnipod 5) or simpler pump (iLet, Mobi)'
  },
  {
    id: 'q5_flexibility',
    number: 5,
    question: 'How flexible have you been finding your treatment to be recently?',
    leftLabel: 'very flexible',
    rightLabel: 'very inflexible',
    leftValue: 6,
    rightValue: 0,
    inverted: false,
    helpText: 'Can you easily adjust your treatment for different activities, meals, or schedules?',
    clinicalNote: 'Low scores suggest need for highly customizable pump with exercise modes'
  },
  {
    id: 'q6_understanding',
    number: 6,
    question: 'How satisfied are you with your understanding of your diabetes?',
    leftLabel: 'very satisfied',
    rightLabel: 'very dissatisfied',
    leftValue: 6,
    rightValue: 0,
    inverted: false,
    helpText: 'Do you feel you understand how to manage your diabetes well?',
    clinicalNote: 'Low scores suggest need for simplest pump (Beta Bionics iLet - no carb counting)'
  },
  {
    id: 'q7_recommend',
    number: 7,
    question: 'Would you recommend this form of treatment to someone else with your kind of diabetes?',
    leftLabel: 'Yes, I would definitely recommend the treatment',
    rightLabel: 'No, I would definitely not recommend the treatment',
    leftValue: 6,
    rightValue: 0,
    inverted: false,
    helpText: 'Would you tell a friend or family member with diabetes to use your current treatment?',
    clinicalNote: 'Low scores = strong signal for major treatment change'
  },
  {
    id: 'q8_continue',
    number: 8,
    question: 'How satisfied would you be to continue with your present form of treatment?',
    leftLabel: 'very satisfied',
    rightLabel: 'very dissatisfied',
    leftValue: 6,
    rightValue: 0,
    inverted: false,
    helpText: 'If you had to keep using your current treatment, how would you feel?',
    clinicalNote: 'Low scores indicate urgent need for change - prioritize most different option'
  }
];

/**
 * Official citation text that must be displayed with the questionnaire
 */
export const DTSQS_CITATION = {
  copyright: 'DTSQs © 1983 Health Psychology Research Ltd.',
  licenseRef: 'For use by Dr Rakesh Patel MD under licence ref CB1744',
  version: 'English for USA (rev. 31.7.94)',
  website: 'www.healthpsychologyresearch.com',
  fullCitation: 'DTSQs © 1983 Health Psychology Research Ltd. For use by Dr Rakesh Patel MD under licence ref CB1744. English for USA (rev. 31.7.94).'
};

/**
 * Score interpretation thresholds
 */
export const DTSQS_SCORING = {
  // Total score ranges (sum of all 8 questions: 0-48)
  totalScore: {
    highSatisfaction: { min: 40, max: 48, label: 'High satisfaction' },
    moderateSatisfaction: { min: 24, max: 39, label: 'Moderate satisfaction' },
    lowSatisfaction: { min: 0, max: 23, label: 'Low satisfaction' }
  },

  // Individual question thresholds
  questionThresholds: {
    satisfied: 4, // 4-6 = satisfied
    neutral: 3, // 3 = neutral
    dissatisfied: 2 // 0-2 = dissatisfied
  },

  // Inverted questions (Q2, Q3) - higher is worse
  invertedThresholds: {
    good: 2, // 0-2 = good control
    moderate: 4, // 3-4 = moderate issues
    poor: 6 // 5-6 = poor control
  }
};

/**
 * AI recommendation weights for each question
 * These determine how much each DTSQs response influences pump selection
 */
export const DTSQS_AI_WEIGHTS = {
  q1_treatment_satisfaction: 0.15, // 15% weight - overall dissatisfaction
  q2_high_blood_sugars: 0.20, // 20% weight - strong signal for algorithm choice
  q3_low_blood_sugars: 0.20, // 20% weight - strong signal for safety features
  q4_convenience: 0.12, // 12% weight - influences form factor choice
  q5_flexibility: 0.10, // 10% weight - influences customization needs
  q6_understanding: 0.08, // 8% weight - influences simplicity requirements
  q7_recommend: 0.08, // 8% weight - secondary satisfaction indicator
  q8_continue: 0.07  // 7% weight - urgency indicator
  // Total: 100% weight
};
