interface SliderData {
  id: string;
  title: string;
  emoji: string;
  category: 'activity' | 'tech' | 'control' | 'social' | 'maintenance';
  examples: {
    low: string;
    medium: string;
    high: string;
  };
}

export interface SliderResponse {
  sliderId: string;
  value: number;
  timestamp: number;
  category: string;
}

export interface SliderProfile {
  userId?: string;
  sessionId: string;
  responses: SliderResponse[];
  profileHash: string;
  createdAt: number;
  completedAt?: number;
}

export interface SliderRecommendation {
  profileId: string;
  topPumps: Array<{
    pumpId: string;
    pumpName: string;
    score: number;
    matchFactors: string[];
    sliderInfluence: Record<string, number>;
  }>;
  personalizedInsights: string[];
  nextSteps: string[];
  confidence: number;
}

export interface SliderAnalysis {
  profile: SliderProfile;
  recommendation: SliderRecommendation;
  cacheKey: string;
  processingTime: number;
  source: 'cache' | 'ai';
}
