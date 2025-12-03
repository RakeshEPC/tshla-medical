/**
 * DTSQs (Diabetes Treatment Satisfaction Questionnaire - Status Version)
 *
 * Licensed to: Dr Rakesh Patel MD (licence ref CB1744)
 * Copyright: © 1983 Health Psychology Research Ltd.
 *
 * This is the baseline/status version that measures current treatment satisfaction.
 * Used BEFORE pump recommendation to establish baseline dissatisfaction.
 */

export interface DTSQsResponse {
  // Q1: How satisfied are you with your current treatment?
  // Scale: 6 (very satisfied) → 0 (very dissatisfied)
  q1_treatment_satisfaction: number;

  // Q2: How often have you felt that your blood sugars have been unacceptably high recently?
  // Scale: 6 (most of the time) → 0 (none of the time)
  // NOTE: Higher score = WORSE control (inverted)
  q2_high_blood_sugars: number;

  // Q3: How often have you felt that your blood sugars have been unacceptably low recently?
  // Scale: 6 (most of the time) → 0 (none of the time)
  // NOTE: Higher score = WORSE control (inverted)
  q3_low_blood_sugars: number;

  // Q4: How convenient have you been finding your treatment to be recently?
  // Scale: 6 (very convenient) → 0 (very inconvenient)
  q4_convenience: number;

  // Q5: How flexible have you been finding your treatment to be recently?
  // Scale: 6 (very flexible) → 0 (very inflexible)
  q5_flexibility: number;

  // Q6: How satisfied are you with your understanding of your diabetes?
  // Scale: 6 (very satisfied) → 0 (very dissatisfied)
  q6_understanding: number;

  // Q7: Would you recommend this form of treatment to someone else with your kind of diabetes?
  // Scale: 6 (definitely yes) → 0 (definitely no)
  q7_recommend: number;

  // Q8: How satisfied would you be to continue with your present form of treatment?
  // Scale: 6 (very satisfied) → 0 (very dissatisfied)
  q8_continue: number;

  // Metadata
  completed_at: string; // ISO 8601 timestamp
  total_score?: number; // Sum of all scores (optional computed field)
  dissatisfaction_score?: number; // Inverted total (higher = more dissatisfied)
}

export interface DTSQsData {
  userId: string; // Supabase auth user ID
  patientId?: string; // Optional patient UUID
  responses: DTSQsResponse;
  skipped?: boolean; // If user chose to skip (but tracked as incomplete)
  version: 'status'; // 'status' for DTSQs, 'change' for DTSQc (future)
}

export interface DTSQsCompletionStatus {
  completed: boolean;
  completedAt?: string;
  responses?: DTSQsResponse;
}

/**
 * Clinical interpretation helpers
 */
export interface DTSQsInterpretation {
  overallSatisfaction: 'high' | 'moderate' | 'low'; // Based on Q1, Q7, Q8
  glycemicControl: 'good' | 'mixed' | 'poor'; // Based on Q2, Q3
  treatmentBurden: 'low' | 'moderate' | 'high'; // Based on Q4, Q5
  needForChange: 'urgent' | 'moderate' | 'mild'; // Based on Q8, total score
  educationNeeded: boolean; // Based on Q6
}

/**
 * AI recommendation weights (how much each question influences pump selection)
 */
export interface DTSQsWeights {
  q1_treatment_satisfaction: number; // Overall dissatisfaction → prefer most different
  q2_high_blood_sugars: number; // Frequent highs → aggressive algorithms
  q3_low_blood_sugars: number; // Frequent lows → conservative algorithms
  q4_convenience: number; // Low convenience → tubeless/simplest
  q5_flexibility: number; // Low flexibility → most customizable
  q6_understanding: number; // Poor understanding → simplest (iLet)
  q7_recommend: number; // Wouldn't recommend → strong signal for change
  q8_continue: number; // Don't want to continue → urgent need
}
