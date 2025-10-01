/**
 * Patient Management Types
 * Comprehensive patient data structures for TSHLA Medical
 */

export interface Patient {
  // Identity
  internalId: string; // 8-digit internal ID for doctors (e.g., "12345678")
  patientAvaId: string; // AVA ###-### format for patient login (e.g., "AVA 123-456")

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;

  // Account Details
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  hasCompletedOnboarding: boolean;

  // Program Enrollment
  programs: {
    pumpdrive?: {
      enrolled: boolean;
      completedCategories?: string[];
      finalRecommendations?: PumpRecommendation[];
      personalReport?: PersonalizedReport;
      lastActivity?: string;
    };
    weightloss?: {
      enrolled: boolean;
      profileId?: string;
      currentPhase?: 'onboarding' | 'active' | 'maintenance';
      lastCheckin?: string;
    };
  };

  // Preferences
  preferences: {
    communicationMethod: 'email' | 'sms' | 'both';
    language: string;
    timezone: string;
  };
}

export interface PumpRecommendation {
  pumpId: string;
  pumpName: string;
  rank: number; // 1 for top choice, 2 for runner-up
  matchScore: number;
  keyReasons: string[];
  personalizedInsights: string;
  categoryScores: Record<string, number>;
}

export interface PersonalizedReport {
  reportId: string;
  generatedAt: string;
  patientName: string;

  // Journey Summary
  journeySummary: {
    categoriesCompleted: string[];
    totalTimeSpent: number; // minutes
    inputMethods: Record<string, 'voice' | 'text'>;
    completionDate: string;
  };

  // Personal Insights
  personalProfile: {
    topPriorities: string[];
    lifestyleFactors: string[];
    medicalConsiderations: string[];
    uniqueNeeds: string[];
  };

  // Final Recommendations
  recommendations: {
    topChoice: {
      pump: PumpRecommendation;
      whyPerfectForYou: string[];
      successTips: string[];
      gettingStartedGuide: string[];
    };
    alternativeChoice?: {
      pump: PumpRecommendation;
      whenToConsider: string[];
      tradeoffs: string[];
    };
  };

  // Encouragement Section
  encouragement: {
    personalMessage: string;
    strengthsIdentified: string[];
    successPredictors: string[];
    nextSteps: string[];
  };

  // Visual Elements
  visualData: {
    categoryRadarChart: Record<string, number>;
    pumpComparisonChart: any;
    journeyTimeline: any;
  };
}

export interface PatientSession {
  sessionId: string;
  patientAvaId: string;
  internalId: string;
  startedAt: string;
  lastActivity: string;
  isActive: boolean;
  deviceInfo?: {
    userAgent: string;
    ip?: string;
  };
}

export interface PatientRegistration {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  program: 'pumpdrive' | 'weightloss' | 'both';
  referralSource?: string;
}

export interface PatientLogin {
  avaId: string; // AVA ###-### format
  email?: string; // Alternative login method
}

export interface ChatMessage {
  id: string;
  patientId: string;
  timestamp: string;
  sender: 'patient' | 'ai';
  type: 'text' | 'voice';
  content: string;
  metadata?: {
    duration?: number; // for voice messages
    sentiment?: 'positive' | 'neutral' | 'concerned';
    topic?: string;
  };
}

export interface WeightLossChat {
  sessionId: string;
  patientId: string;
  messages: ChatMessage[];
  context: {
    currentWeight?: number;
    goalWeight?: number;
    recentProgress?: {
      weightChange: number;
      timeframe: string;
    };
    currentChallenges?: string[];
    medications?: string[];
  };
  aiRecommendations?: {
    mealSuggestions?: string[];
    exerciseTips?: string[];
    motivationalInsights?: string[];
  };
}
