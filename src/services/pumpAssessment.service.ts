import { logError, logWarn, logInfo, logDebug } from './logger.service';
import { pumpAuthService } from './pumpAuth.service';
import { supabase } from '../lib/supabase';
import { supabaseAuthService } from './supabaseAuth.service';

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
  // Pump recommendation tracking (top 3 choices)
  firstChoicePump?: string;
  secondChoicePump?: string;
  thirdChoicePump?: string;
  recommendationDate?: string;
  assessmentVersion?: number;
}

export interface SaveAssessmentResponse {
  success: boolean;
  assessmentId: string; // UUID from Supabase
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
   * Save complete assessment to database (Supabase)
   */
  async saveAssessment(assessmentData: AssessmentData): Promise<SaveAssessmentResponse> {
    try {
      console.log('🔍 [PumpAssessment] Starting save process...');
      logInfo('PumpAssessment', 'Saving assessment to Supabase', {
        patientName: assessmentData.patientName,
        flow: assessmentData.assessmentFlow
      });

      // Get current authenticated user
      console.log('🔍 [PumpAssessment] Fetching current authenticated user...');
      const userResult = await supabaseAuthService.getCurrentUser();

      console.log('🔍 [PumpAssessment] Auth result:', {
        success: userResult.success,
        hasUser: !!userResult.user,
        userId: userResult.user?.id,
        email: userResult.user?.email,
        role: userResult.user?.role,
        accessType: userResult.user?.accessType,
      });

      if (!userResult.success || !userResult.user) {
        console.error('❌ [PumpAssessment] User not authenticated!', userResult.error);
        logError('PumpAssessment', 'User not authenticated', { error: userResult.error });
        throw new Error('User must be logged in to save assessment');
      }

      const currentUser = userResult.user;
      console.log('✅ [PumpAssessment] User authenticated:', {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
      });

      // Extract pump choices from AI recommendation
      const firstChoicePump = assessmentData.aiRecommendation?.topChoice?.name;
      const secondChoicePump = assessmentData.aiRecommendation?.alternatives?.[0]?.name;
      const thirdChoicePump = assessmentData.aiRecommendation?.alternatives?.[1]?.name;

      console.log('🔍 [PumpAssessment] Pump choices extracted:', {
        first: firstChoicePump,
        second: secondChoicePump,
        third: thirdChoicePump,
      });

      // Prepare data for insert
      const insertData = {
        patient_id: currentUser.id, // Link to patients table
        patient_name: assessmentData.patientName,
        slider_values: assessmentData.sliderValues || {},
        selected_features: assessmentData.selectedFeatures || [],
        lifestyle_text: assessmentData.personalStory,
        challenges_text: assessmentData.challenges,
        priorities_text: assessmentData.priorities,
        clarification_responses: assessmentData.clarifyingResponses || {},
        final_recommendation: assessmentData.aiRecommendation,
        first_choice_pump: firstChoicePump,
        second_choice_pump: secondChoicePump,
        third_choice_pump: thirdChoicePump,
        recommendation_date: new Date().toISOString(),
        assessment_version: assessmentData.assessmentVersion || 1,
        created_at: assessmentData.timestamp,
      };

      console.log('🔍 [PumpAssessment] Preparing to insert data:', {
        patient_id: insertData.patient_id,
        patient_name: insertData.patient_name,
        hasSliderValues: Object.keys(insertData.slider_values).length > 0,
        hasSelectedFeatures: insertData.selected_features.length > 0,
        hasRecommendation: !!insertData.final_recommendation,
      });

      // Insert assessment into Supabase
      console.log('🔍 [PumpAssessment] Attempting database insert...');
      const { data, error } = await supabase
        .from('pump_assessments')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ [PumpAssessment] Database insert failed!', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error,
        });

        logError('PumpAssessment', 'Supabase insert failed', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        // Provide more helpful error messages
        let errorMessage = error.message;
        if (error.code === '42501') {
          errorMessage = 'Permission denied: Your account may not have permission to save assessments. Please contact support.';
        } else if (error.code === '23503') {
          errorMessage = 'Database reference error: Patient record not found. Please try logging in again.';
        } else if (error.message.includes('RLS')) {
          errorMessage = 'Security policy error: Unable to save assessment. Please try logging out and back in.';
        }

        throw new Error(`Database error: ${errorMessage}`);
      }

      if (!data) {
        console.error('❌ [PumpAssessment] No data returned from insert!');
        logError('PumpAssessment', 'No data returned from insert', {});
        throw new Error('No data returned from database insert');
      }

      console.log('✅ [PumpAssessment] Assessment saved successfully!', {
        assessmentId: data.id,
        patientId: data.patient_id,
        timestamp: data.created_at,
      });

      logInfo('PumpAssessment', 'Assessment saved successfully to Supabase', {
        assessmentId: data.id
      });

      return {
        success: true,
        assessmentId: data.id,
        message: 'Assessment saved successfully',
      };
    } catch (error) {
      console.error('❌ [PumpAssessment] Save failed:', error);
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
   * Retrieve assessment by ID from Supabase
   */
  async getAssessment(assessmentId: string): Promise<AssessmentData | null> {
    try {
      const { data, error } = await supabase
        .from('pump_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null;
        }
        throw new Error(error.message);
      }

      // Map database fields to AssessmentData interface
      return {
        patientName: data.patient_name,
        sliderValues: data.slider_values || {},
        selectedFeatures: data.selected_features || [],
        personalStory: data.lifestyle_text || '',
        challenges: data.challenges_text,
        priorities: data.priorities_text,
        clarifyingResponses: data.clarification_responses || {},
        aiRecommendation: data.final_recommendation,
        conversationHistory: [],
        assessmentFlow: 'hybrid',
        timestamp: data.created_at,
        firstChoicePump: data.first_choice_pump,
        secondChoicePump: data.second_choice_pump,
        thirdChoicePump: data.third_choice_pump,
        recommendationDate: data.recommendation_date,
        assessmentVersion: data.assessment_version,
      };
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