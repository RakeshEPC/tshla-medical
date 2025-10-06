// Context 7 MCP Type Definitions for Pump Drive Assessment

export interface PumpSession {
  sessionId: string;
  userId: string;
  deviceId?: string; // For guest users
  responses: Record<string, number>;
  priorities: string[];
  selectedFeatures?: any[];
  freeText?: string;
  completedQuestions: string[];
  totalQuestions: number;
  percentComplete: number;
  createdAt: number;
  lastUpdated: number;
  expiresAt: number;
  completedAt?: number;
  status: 'incomplete' | 'complete' | 'abandoned';
}

export interface PumpFeedback {
  feedbackId: string;
  sessionId: string;
  userId: string; // SHA-256 hashed for analytics
  recommendedPump: string;
  actualPump: string | null;
  feedbackType: 'same' | 'different' | 'still_deciding';
  reason?: string;
  reasonCategory?: 'cost' | 'insurance' | 'tubeless' | 'cgm' | 'other';
  timestamp: number;
  accuracy: number; // 1 if same, 0 if different
}

export interface ConflictRule {
  name: string;
  features: string[];
  conflictType: 'mutually_exclusive' | 'no_overlap' | 'compatibility_issue';
  severity: 'high' | 'medium' | 'low';
  message: string;
  resolution: string;
  affectedPumps?: string[];
}

export interface ConflictDetection {
  hasConflict: boolean;
  conflicts: Array<{
    rule: ConflictRule;
    detectedFeatures: string[];
    suggestion: string;
  }>;
}

export interface ConflictResolution {
  conflictName: string;
  userChoice: string;
  priorityFeature: string;
  deprioritizedFeature: string;
  timestamp: number;
}

export interface PumpAnalytics {
  overallAccuracy: number; // Percentage
  totalFeedback: number;
  feedbackByPump: Record<string, {
    recommended: number;
    chosen: number;
    accuracy: number;
  }>;
  feedbackByUserSegment: Record<string, {
    count: number;
    accuracy: number;
  }>;
  topReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  timeRange: {
    start: number;
    end: number;
    days: number;
  };
}

export interface SessionStorageData {
  pumpDriveSliders?: Record<string, number>;
  selectedPumpFeatures?: any[];
  pumpDriveFreeText?: {
    currentSituation: string;
    concerns?: string;
    priorities?: string;
  };
  pumpDrivePriorities?: string[];
}

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: number | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  error?: string;
}

export interface WelcomeBackData {
  sessionFound: boolean;
  session?: PumpSession;
  lastVisit: string; // Human-readable date
  completionStatus: string; // e.g., "4/9 questions answered"
  estimatedTimeRemaining: string; // e.g., "~2 minutes"
  canResume: boolean;
}

// MCP Tool Schemas
export interface MCPGetContextRequest {
  userId: string;
  includeAnalytics?: boolean;
}

export interface MCPGetContextResponse {
  session: PumpSession | null;
  feedback: PumpFeedback[];
  analytics?: PumpAnalytics;
  conflicts?: ConflictDetection;
}

export interface MCPSaveSessionRequest {
  userId: string;
  responses: Record<string, number>;
  priorities: string[];
  selectedFeatures?: any[];
  freeText?: string;
  completedQuestions: string[];
  totalQuestions: number;
}

export interface MCPSaveSessionResponse {
  success: boolean;
  sessionId: string;
  message?: string;
}

export interface MCPTrackFeedbackRequest {
  sessionId: string;
  userId: string;
  recommendedPump: string;
  actualPump: string | null;
  feedbackType: 'same' | 'different' | 'still_deciding';
  reason?: string;
  reasonCategory?: 'cost' | 'insurance' | 'tubeless' | 'cgm' | 'other';
}

export interface MCPTrackFeedbackResponse {
  success: boolean;
  feedbackId: string;
  updatedAccuracy: number;
}

export interface MCPDetectConflictsRequest {
  responses: Record<string, number>;
  selectedFeatures: any[];
}

export interface MCPDetectConflictsResponse {
  conflicts: ConflictDetection;
}
