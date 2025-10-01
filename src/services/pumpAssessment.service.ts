import { logError, logWarn, logInfo, logDebug } from './logger.service';
import { pumpAuthService } from './pumpAuth.service';

export interface AssessmentData {
  patientName: string;
  userId?: number; // Link to authenticated user
  sliderValues: Record<string, number>;
  selectedFeatures: Array<{ id: string; title: string; pumpId?: string }>;
  personalStory: string;
  challenges?: string;
  priorities?: string;
  clarifyingResponses: Record<string, string>;
  aiRecommendation: {
    topChoice: {
      name: string;
      score: number;
      reasons: string[];
    };
    alternatives: Array<{
      name: string;
      score: number;
      reasons: string[];
    }>;
    keyFactors: string[];
    personalizedInsights: string;
  };
  conversationHistory: Array<{
    question: string;
    answer: string;
    timestamp: string;
  }>;
  assessmentFlow?: string; // 'sliders' | 'conversation' | 'hybrid'
  timestamp: string;
}

export interface SaveAssessmentResponse {
  success: boolean;
  assessmentId: number;
  message: string;
  pdfUrl?: string;
}

class PumpAssessmentService {
  private baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://api.tshla.ai'
    : 'http://localhost:3005';

  /**
   * Collect all assessment data from sessionStorage
   */
  collectAssessmentData(patientName: string): AssessmentData {
    logDebug('PumpAssessment', 'Collecting assessment data from sessionStorage', {});

    // Collect slider values
    const sliderValues = JSON.parse(sessionStorage.getItem('pumpDriveSliders') || '{}');

    // Collect selected features
    const selectedFeatures = JSON.parse(sessionStorage.getItem('selectedPumpFeatures') || '[]');

    // Collect personal story and text responses
    const freeTextData = JSON.parse(sessionStorage.getItem('pumpDriveFreeText') || '{}');
    const personalStory = freeTextData.currentSituation || freeTextData.userStory || '';
    const challenges = freeTextData.challenges || '';
    const priorities = freeTextData.priorities || '';

    // Collect clarifying responses
    const clarifyingResponses = JSON.parse(sessionStorage.getItem('pumpDriveClarifyingResponses') || '{}');

    // Collect AI recommendation
    const aiRecommendation = JSON.parse(sessionStorage.getItem('pumpdrive_recommendation') ||
      sessionStorage.getItem('pumpDriveRecommendation') || 'null');

    // Collect conversation history
    const conversationHistory = JSON.parse(sessionStorage.getItem('pumpDriveConversation') || '[]');

    // Determine assessment flow
    let assessmentFlow = 'hybrid';
    if (Object.keys(sliderValues).length > 0) {
      assessmentFlow = 'sliders';
    }
    if (sessionStorage.getItem('pumpdrive_responses')) {
      assessmentFlow = 'conversation';
    }

    return {
      patientName,
      sliderValues,
      selectedFeatures,
      personalStory,
      challenges,
      priorities,
      clarifyingResponses,
      aiRecommendation: aiRecommendation || {
        topChoice: { name: 'Not generated', score: 0, reasons: [] },
        alternatives: [],
        keyFactors: [],
        personalizedInsights: 'AI recommendation not available'
      },
      conversationHistory,
      assessmentFlow,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Save complete assessment to database
   */
  async saveAssessment(assessmentData: AssessmentData): Promise<SaveAssessmentResponse> {
    try {
      logInfo('PumpAssessment', 'Saving assessment to database', {
        patientName: assessmentData.patientName,
        flow: assessmentData.assessmentFlow
      });

      // Get authentication headers
      const authHeaders = pumpAuthService.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/api/pump-assessments/save-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(assessmentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      logInfo('PumpAssessment', 'Assessment saved successfully', {
        assessmentId: result.assessmentId
      });

      return result;
    } catch (error) {
      logError('PumpAssessment', 'Failed to save assessment', { error });
      throw new Error(`Failed to save assessment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save assessment with auto-collected data
   */
  async saveCurrentAssessment(patientName?: string): Promise<SaveAssessmentResponse> {
    const defaultName = patientName || `User_${Date.now()}`;
    const assessmentData = this.collectAssessmentData(defaultName);

    return await this.saveAssessment(assessmentData);
  }

  /**
   * Retrieve assessment by ID
   */
  async getAssessment(assessmentId: number): Promise<AssessmentData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pump-assessments/${assessmentId}/complete`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logError('PumpAssessment', 'Failed to retrieve assessment', { error, assessmentId });
      throw new Error(`Failed to retrieve assessment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate PDF report for assessment
   */
  async generatePDF(assessmentId: number): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pump-assessments/${assessmentId}/generate-pdf`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.pdfUrl;
    } catch (error) {
      logError('PumpAssessment', 'Failed to generate PDF', { error, assessmentId });
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all session storage data after successful save
   */
  clearSessionData(): void {
    const keysToRemove = [
      'pumpDriveSliders',
      'selectedPumpFeatures',
      'pumpDriveFreeText',
      'pumpDriveClarifyingResponses',
      'pumpDriveClarifyingQuestions',
      'pumpdrive_recommendation',
      'pumpDriveRecommendation',
      'pumpDriveConversation',
      'pumpdrive_responses',
      'pumpDriveCompletedCategories',
      'pumpdrive_category_order',
      'pumpdrive_completed_categories',
      'pumpdrive_priority_order'
    ];

    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });

    logDebug('PumpAssessment', 'Session storage cleared after successful save', {});
  }
}

export const pumpAssessmentService = new PumpAssessmentService();