/**
 * Weight Loss System Data Models
 * Comprehensive patient profile and tracking types
 */

// Demographics
export interface Demographics {
  age: number;
  sex: 'male' | 'female' | 'other';
  gender?: string;
  height: number; // in cm
  startingWeight: number; // in kg
  targetWeight?: number; // in kg
  targetPercentage?: number; // % to lose
  preferredUnits: {
    weight: 'kg' | 'lb';
    height: 'cm' | 'inches';
  };
}

// Medical Context
export interface MedicalContext {
  diagnoses: Array<{
    condition: string;
    diagnosedDate?: string;
    severity?: 'mild' | 'moderate' | 'severe';
  }>;
  currentMedications: Array<{
    name: string;
    type: 'glp1' | 'thyroid' | 'insulin' | 'other';
    dosage?: string;
    frequency?: string;
    startedDate?: string;
  }>;
  labResults: {
    a1c?: number;
    tsh?: number;
    lipids?: {
      total?: number;
      ldl?: number;
      hdl?: number;
      triglycerides?: number;
    };
    lastUpdated?: string;
  };
  medicalHistory: {
    giIssues?: boolean;
    eatingDisorderHistory?: boolean;
    pregnancyStatus?: 'not_applicable' | 'not_pregnant' | 'pregnant' | 'planning';
    surgicalHistory?: string[];
  };
}

// Dietary & Cultural Profile
export interface DietaryProfile {
  dietPattern: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'flexitarian';
  culturalDiet?: 'jain' | 'halal' | 'kosher' | 'hindu_vegetarian' | 'other';
  foodsToAvoid: {
    allergies: string[];
    intolerances: string[];
    preferences: string[];
    religious: string[];
    medical: string[];
  };
  staples: {
    breakfast: string[];
    lunch: string[];
    dinner: string[];
    snacks: string[];
  };
  cuisinePreferences: string[];
  fastingPractices?: {
    type: 'ramadan' | 'navratri' | 'lent' | 'intermittent' | 'other';
    schedule?: string;
    restrictions?: string[];
  };
}

// Lifestyle Factors
export interface LifestyleFactors {
  schedule: {
    wakeTime: string; // "06:00"
    sleepTime: string; // "22:00"
    workShift: 'day' | 'night' | 'rotating' | 'flexible';
    mealTimes: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
    };
  };
  activity: {
    baseline: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
    stepsPerDay?: number;
    exerciseHabits: {
      frequency: 'none' | 'occasional' | '1-2x_week' | '3-4x_week' | '5+_week';
      types: string[];
      gymAccess: boolean;
      homeEquipment: string[];
    };
  };
  cooking: {
    homeVsRestaurant: number; // percentage home cooking (0-100)
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
    timeAvailable: 'minimal' | 'moderate' | 'plenty';
    budget: 'tight' | 'moderate' | 'flexible';
  };
  travel: {
    frequency: 'never' | 'occasional' | 'monthly' | 'weekly';
    types: 'domestic' | 'international' | 'both';
  };
}

// Targets & Guardrails
export interface HealthTargets {
  protein: {
    target: number; // grams per day
    calculation: 'fixed' | 'per_kg'; // fixed amount or g/kg body weight
    perKg?: number; // if calculation is per_kg
  };
  steps: {
    minimum: number;
    target: number;
  };
  sleep: {
    minimumHours: number;
    targetHours: number;
  };
  hydration: {
    target: number; // ml per day
    reminderFrequency?: number; // hours between reminders
  };
  redFlags: {
    dizziness: boolean;
    vomitingDuration: number; // hours before escalation
    severNausea: boolean;
    chestPain: boolean;
    severeWeakness: boolean;
    customRules: Array<{
      symptom: string;
      threshold: string;
      action: string;
    }>;
  };
}

// Engagement Preferences
export interface EngagementPreferences {
  communication: {
    bestTimes: string[]; // ["08:00", "12:00", "18:00"]
    quietHours: {
      start: string;
      end: string;
    };
    frequency: 'minimal' | 'daily' | 'multiple_daily';
    channels: ('app' | 'sms' | 'email' | 'push')[];
  };
  tone: 'coach' | 'cheerleader' | 'matter_of_fact' | 'tough_love' | 'medical';
  language: string; // ISO language code
  consent: {
    dataSharing: boolean;
    anonymizedAnalytics: boolean;
    coachingBoundaries: string[];
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
}

// Complete Weight Loss Profile
export interface WeightLossProfile {
  patientId: string;
  createdAt: string;
  updatedAt: string;
  demographics: Demographics;
  medical: MedicalContext;
  dietary: DietaryProfile;
  lifestyle: LifestyleFactors;
  targets: HealthTargets;
  preferences: EngagementPreferences;
  onboardingComplete: boolean;
  activeProgram?: string;
}

// Daily Check-in Data
export interface DailyCheckin {
  date: string;
  patientId: string;
  weight?: number;
  steps?: number;
  protein?: number;
  sleep?: number;
  hydration?: number;
  hungerScore: number; // 0-10
  nausea: number; // 0-10
  constipation: number; // 0-10
  otherSymptoms?: string[];
  notes?: string;
  photos?: {
    meals?: string[];
    progress?: string[];
  };
  mood?: 'great' | 'good' | 'okay' | 'low' | 'terrible';
}

// Weekly Check-in Data
export interface WeeklyCheckin {
  weekStarting: string;
  patientId: string;
  energyLevel: number; // 0-10
  adherenceScore: number; // 0-100
  mainChallenge?: string;
  wins?: string[];
  confidenceRating: number; // 0-10
  motivationRating: number; // 0-10
  redFlagSymptoms: string[];
  weeklyMeasurements?: {
    waist?: number;
    hips?: number;
    chest?: number;
    arms?: number;
    thighs?: number;
  };
  medicationAdherence?: {
    missed: number;
    reason?: string;
  };
}

// System Metadata
export interface PatientMetadata {
  cohorts: string[]; // ['glp1_user', 'vegetarian', 'pcos', 'shift_worker']
  engagementStats: {
    replyRate: number; // percentage
    checkinStreak: number; // days
    lastActive: string;
    nudgesCompleted: number;
    dropoffs: number;
  };
  progressMarkers: {
    week4: number; // % weight change
    week8: number;
    week12: number;
    bestWeek: number;
    currentPlateau?: number; // days at same weight
  };
  interventions: Array<{
    date: string;
    type: string;
    reason: string;
    outcome?: string;
  }>;
  escalations: Array<{
    date: string;
    trigger: string;
    action: string;
    resolved: boolean;
  }>;
}

// Recommendation Models
export interface MealPlan {
  id: string;
  patientId: string;
  weekOf: string;
  meals: Array<{
    day: string;
    meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    name: string;
    ingredients: string[];
    calories: number;
    protein: number;
    instructions?: string;
    prepTime?: number;
    culturallyApproved: boolean;
  }>;
  shoppingList: Array<{
    category: string;
    items: string[];
  }>;
  prepInstructions?: string[];
}

export interface ExercisePlan {
  id: string;
  patientId: string;
  weekOf: string;
  activities: Array<{
    day: string;
    type: string;
    duration: number; // minutes
    intensity: 'low' | 'moderate' | 'high';
    instructions: string;
    alternatives?: string[];
    equipment?: string[];
  }>;
  weeklyStepGoal: number;
  restDays: string[];
}

// Stall Intervention
export interface StallIntervention {
  type: 'protein_reset' | 'carb_cycle' | 'activity_boost' | 'stress_management' | 'sleep_focus';
  duration: number; // days
  plan: {
    daily: any[]; // Specific to intervention type
    goals: string[];
    tracking: string[];
  };
  expectedOutcome: string;
}
