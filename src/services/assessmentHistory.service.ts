/**
 * Assessment History Service
 * Fetches and manages user assessment data from database
 * Created: October 5, 2025
 */

import { logError, logInfo, logDebug } from './logger.service';

export interface StoredAssessment {
  id: number;
  userId: number;
  patientName: string;
  sliderValues: Record<string, number>;
  selectedFeatures: Array<{ name: string; title?: string; id?: string }>;
  personalStory: string;
  challenges: string;
  priorities: string;
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
  conversationHistory: any[];
  assessmentFlow: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSummary {
  id: number;
  createdAt: string;
  recommendedPump: string;
  score: number;
  assessmentFlow: string;
}

class AssessmentHistoryService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_PUMP_API_URL || 'http://localhost:3002';
  }

  /**
   * Get a single assessment by ID
   */
  async getAssessmentById(assessmentId: number): Promise<StoredAssessment | null> {
    try {
      logDebug('AssessmentHistory', 'Fetching assessment', { assessmentId });

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.apiUrl}/api/pumpdrive/assessments/${assessmentId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch assessment: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.assessment) {
        logInfo('AssessmentHistory', 'Assessment fetched successfully', { assessmentId });
        return this.transformAssessment(data.assessment);
      }

      return null;
    } catch (error) {
      logError('AssessmentHistory', 'Error fetching assessment', { error, assessmentId });
      throw error;
    }
  }

  /**
   * Get all assessments for a user
   */
  async getUserAssessments(userId: number): Promise<AssessmentSummary[]> {
    try {
      logDebug('AssessmentHistory', 'Fetching user assessments', { userId });

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.apiUrl}/api/pumpdrive/assessments/user/${userId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user assessments: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.assessments) {
        logInfo('AssessmentHistory', 'User assessments fetched', {
          userId,
          count: data.assessments.length
        });
        return data.assessments.map(this.transformSummary);
      }

      return [];
    } catch (error) {
      logError('AssessmentHistory', 'Error fetching user assessments', { error, userId });
      throw error;
    }
  }

  /**
   * Get current user's assessments
   */
  async getCurrentUserAssessments(): Promise<AssessmentSummary[]> {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.apiUrl}/api/pumpdrive/assessments/current-user`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          logDebug('AssessmentHistory', 'User not authenticated');
          return [];
        }
        throw new Error(`Failed to fetch current user assessments: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.assessments) {
        logInfo('AssessmentHistory', 'Current user assessments fetched', {
          count: data.assessments.length
        });
        return data.assessments.map(this.transformSummary);
      }

      return [];
    } catch (error) {
      logError('AssessmentHistory', 'Error fetching current user assessments', { error });
      return []; // Return empty array instead of throwing for auth issues
    }
  }

  /**
   * Email assessment to healthcare provider
   */
  async emailAssessmentToProvider(
    assessmentId: number,
    providerEmail: string,
    patientMessage?: string
  ): Promise<boolean> {
    try {
      logDebug('AssessmentHistory', 'Emailing assessment to provider', {
        assessmentId,
        providerEmail
      });

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.apiUrl}/api/pumpdrive/assessments/${assessmentId}/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          providerEmail,
          patientMessage
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to email assessment: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        logInfo('AssessmentHistory', 'Assessment emailed successfully', {
          assessmentId,
          providerEmail
        });
        return true;
      }

      return false;
    } catch (error) {
      logError('AssessmentHistory', 'Error emailing assessment', { error, assessmentId });
      throw error;
    }
  }

  /**
   * Transform raw assessment data from API
   */
  private transformAssessment(raw: any): StoredAssessment {
    return {
      id: raw.id,
      userId: raw.user_id,
      patientName: raw.patient_name || '',
      sliderValues: this.parseJSON(raw.slider_values, {}),
      selectedFeatures: this.parseJSON(raw.selected_features, []),
      personalStory: raw.personal_story || '',
      challenges: raw.challenges || '',
      priorities: raw.priorities || '',
      clarifyingResponses: this.parseJSON(raw.clarifying_responses, {}),
      aiRecommendation: this.parseJSON(raw.ai_recommendation, {
        topChoice: { name: '', score: 0, reasons: [] },
        alternatives: [],
        keyFactors: [],
        personalizedInsights: ''
      }),
      conversationHistory: this.parseJSON(raw.conversation_history, []),
      assessmentFlow: raw.assessment_flow || 'unified',
      createdAt: raw.created_at,
      updatedAt: raw.updated_at
    };
  }

  /**
   * Transform assessment summary
   */
  private transformSummary(raw: any): AssessmentSummary {
    const aiRec = typeof raw.ai_recommendation === 'string'
      ? JSON.parse(raw.ai_recommendation)
      : raw.ai_recommendation;

    return {
      id: raw.id,
      createdAt: raw.created_at,
      recommendedPump: raw.recommended_pump || aiRec?.topChoice?.name || 'Unknown',
      score: raw.score || aiRec?.topChoice?.score || 0,
      assessmentFlow: raw.assessment_flow || 'unified'
    };
  }

  /**
   * Safely parse JSON fields
   */
  private parseJSON(value: any, defaultValue: any): any {
    if (!value) return defaultValue;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Get assessment from current session storage (fallback)
   */
  getSessionAssessment(): Partial<StoredAssessment> | null {
    try {
      const sliderData = sessionStorage.getItem('pumpDriveSliders');
      const featureData = sessionStorage.getItem('selectedPumpFeatures');
      const freeTextData = sessionStorage.getItem('pumpDriveFreeText');
      const clarifyingData = sessionStorage.getItem('pumpDriveClarifyingResponses');

      if (!sliderData && !featureData && !freeTextData) {
        return null;
      }

      return {
        sliderValues: sliderData ? JSON.parse(sliderData) : {},
        selectedFeatures: featureData ? JSON.parse(featureData) : [],
        personalStory: freeTextData ? JSON.parse(freeTextData).currentSituation || '' : '',
        challenges: freeTextData ? JSON.parse(freeTextData).challenges || '' : '',
        priorities: freeTextData ? JSON.parse(freeTextData).priorities || '' : '',
        clarifyingResponses: clarifyingData ? JSON.parse(clarifyingData) : {}
      };
    } catch (error) {
      logError('AssessmentHistory', 'Error getting session assessment', { error });
      return null;
    }
  }
}

export const assessmentHistoryService = new AssessmentHistoryService();
