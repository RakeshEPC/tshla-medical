import { supabase } from '../lib/supabase';
import { supabaseAuthService } from './supabaseAuth.service';
import { logError, logInfo, logDebug, logWarn } from './logger.service';
import type {
  DTSQsResponse,
  DTSQsData,
  DTSQsCompletionStatus,
  DTSQsInterpretation
} from '../types/dtsqs.types';
import { DTSQS_SCORING } from '../data/dtsqsQuestions';

const SESSION_STORAGE_KEY = 'pumpdrive_dtsqs_responses';
const COMPLETION_FLAG_KEY = 'pumpdrive_dtsqs_completed';

class DTSQsService {
  /**
   * Save DTSQs responses to both Supabase and sessionStorage
   */
  async saveDTSQsResponses(responses: DTSQsResponse): Promise<{ success: boolean; error?: string }> {
    try {
      logDebug('DTSQsService', 'Saving DTSQs responses', { responses });

      // Get current authenticated user
      const userResult = await supabaseAuthService.getCurrentUser();
      if (!userResult.success || !userResult.user) {
        logWarn('DTSQsService', 'No authenticated user - saving to sessionStorage only', {});
        this.saveToSessionStorage(responses);
        return { success: true };
      }

      const userId = userResult.user.id;

      // Calculate scores
      const totalScore = this.calculateTotalScore(responses);
      const dissatisfactionScore = this.calculateDissatisfactionScore(responses);

      const completedResponses: DTSQsResponse = {
        ...responses,
        total_score: totalScore,
        dissatisfaction_score: dissatisfactionScore,
        completed_at: new Date().toISOString()
      };

      // Save to sessionStorage as backup
      this.saveToSessionStorage(completedResponses);

      // Save to Supabase patients table
      const { error: updateError } = await supabase
        .from('patients')
        .update({
          dtsqs_responses: completedResponses,
          dtsqs_completed: true,
          dtsqs_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', userId);

      if (updateError) {
        logError('DTSQsService', 'Failed to save DTSQs to Supabase', { error: updateError });
        // Don't fail - we have sessionStorage backup
        return { success: true, error: 'Saved locally only' };
      }

      logInfo('DTSQsService', 'DTSQs responses saved successfully', {
        userId,
        totalScore,
        dissatisfactionScore
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('DTSQsService', 'Error saving DTSQs responses', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if user has completed DTSQs questionnaire
   */
  async getDTSQsCompletion(userId?: string): Promise<DTSQsCompletionStatus> {
    try {
      // Check sessionStorage first (fastest)
      const sessionCompleted = sessionStorage.getItem(COMPLETION_FLAG_KEY) === 'true';
      const sessionResponses = this.getSessionStorageResponses();

      if (sessionCompleted && sessionResponses) {
        return {
          completed: true,
          completedAt: sessionResponses.completed_at,
          responses: sessionResponses
        };
      }

      // Check Supabase
      let userIdToCheck = userId;
      if (!userIdToCheck) {
        const userResult = await supabaseAuthService.getCurrentUser();
        if (!userResult.success || !userResult.user) {
          return { completed: false };
        }
        userIdToCheck = userResult.user.id;
      }

      const { data, error } = await supabase
        .from('patients')
        .select('dtsqs_completed, dtsqs_completed_at, dtsqs_responses')
        .eq('auth_user_id', userIdToCheck)
        .single();

      if (error || !data) {
        log

Warn('DTSQsService', 'Could not fetch DTSQs completion status', { error });
        return { completed: false };
      }

      if (data.dtsqs_completed && data.dtsqs_responses) {
        // Cache in sessionStorage
        this.saveToSessionStorage(data.dtsqs_responses);
        sessionStorage.setItem(COMPLETION_FLAG_KEY, 'true');

        return {
          completed: true,
          completedAt: data.dtsqs_completed_at,
          responses: data.dtsqs_responses
        };
      }

      return { completed: false };
    } catch (error) {
      logError('DTSQsService', 'Error checking DTSQs completion', { error });
      return { completed: false };
    }
  }

  /**
   * Get DTSQs responses from sessionStorage
   */
  getSessionStorageResponses(): DTSQsResponse | null {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as DTSQsResponse;
    } catch (error) {
      logError('DTSQsService', 'Error parsing sessionStorage DTSQs', { error });
      return null;
    }
  }

  /**
   * Save to sessionStorage
   */
  private saveToSessionStorage(responses: DTSQsResponse): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(responses));
      sessionStorage.setItem(COMPLETION_FLAG_KEY, 'true');
    } catch (error) {
      logError('DTSQsService', 'Error saving to sessionStorage', { error });
    }
  }

  /**
   * Clear DTSQs data from sessionStorage
   */
  clearSessionStorage(): void {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(COMPLETION_FLAG_KEY);
  }

  /**
   * Calculate total score (sum of all 8 questions: 0-48)
   */
  calculateTotalScore(responses: DTSQsResponse): number {
    return (
      responses.q1_treatment_satisfaction +
      responses.q2_high_blood_sugars +
      responses.q3_low_blood_sugars +
      responses.q4_convenience +
      responses.q5_flexibility +
      responses.q6_understanding +
      responses.q7_recommend +
      responses.q8_continue
    );
  }

  /**
   * Calculate dissatisfaction score (inverted total - higher = more dissatisfied)
   * Inverts Q2 and Q3 since they're scored oppositely
   */
  calculateDissatisfactionScore(responses: DTSQsResponse): number {
    return (
      (6 - responses.q1_treatment_satisfaction) + // Invert satisfaction
      responses.q2_high_blood_sugars + // Already inverted (higher = worse)
      responses.q3_low_blood_sugars + // Already inverted (higher = worse)
      (6 - responses.q4_convenience) + // Invert convenience
      (6 - responses.q5_flexibility) + // Invert flexibility
      (6 - responses.q6_understanding) + // Invert understanding
      (6 - responses.q7_recommend) + // Invert recommendation
      (6 - responses.q8_continue) // Invert continuation
    );
  }

  /**
   * Interpret DTSQs responses for clinical insights
   */
  interpretResponses(responses: DTSQsResponse): DTSQsInterpretation {
    const totalScore = responses.total_score || this.calculateTotalScore(responses);

    // Overall satisfaction (based on Q1, Q7, Q8)
    const satisfactionAvg = (responses.q1_treatment_satisfaction + responses.q7_recommend + responses.q8_continue) / 3;
    let overallSatisfaction: 'high' | 'moderate' | 'low';
    if (satisfactionAvg >= 4) overallSatisfaction = 'high';
    else if (satisfactionAvg >= 2) overallSatisfaction = 'moderate';
    else overallSatisfaction = 'low';

    // Glycemic control (based on Q2, Q3)
    const glycemicAvg = (responses.q2_high_blood_sugars + responses.q3_low_blood_sugars) / 2;
    let glycemicControl: 'good' | 'mixed' | 'poor';
    if (glycemicAvg <= 2) glycemicControl = 'good';
    else if (glycemicAvg <= 4) glycemicControl = 'mixed';
    else glycemicControl = 'poor';

    // Treatment burden (based on Q4, Q5)
    const burdenAvg = (responses.q4_convenience + responses.q5_flexibility) / 2;
    let treatmentBurden: 'low' | 'moderate' | 'high';
    if (burdenAvg >= 4) treatmentBurden = 'low';
    else if (burdenAvg >= 2) treatmentBurden = 'moderate';
    else treatmentBurden = 'high';

    // Need for change (based on Q8 and total score)
    let needForChange: 'urgent' | 'moderate' | 'mild';
    if (responses.q8_continue <= 2 || totalScore < DTSQS_SCORING.totalScore.lowSatisfaction.max) {
      needForChange = 'urgent';
    } else if (responses.q8_continue <= 4 || totalScore < DTSQS_SCORING.totalScore.moderateSatisfaction.max) {
      needForChange = 'moderate';
    } else {
      needForChange = 'mild';
    }

    // Education needed (based on Q6)
    const educationNeeded = responses.q6_understanding < 4;

    return {
      overallSatisfaction,
      glycemicControl,
      treatmentBurden,
      needForChange,
      educationNeeded
    };
  }

  /**
   * Mark DTSQs as skipped (incomplete)
   */
  async markAsSkipped(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          dtsqs_completed: false,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', userId);

      if (error) {
        logError('DTSQsService', 'Failed to mark DTSQs as skipped', { error });
      }
    } catch (error) {
      logError('DTSQsService', 'Error marking DTSQs as skipped', { error });
    }
  }
}

export const dtsqsService = new DTSQsService();
