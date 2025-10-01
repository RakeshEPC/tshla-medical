import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
/**
 * Secure storage for pump questionnaire data
 * Replaces localStorage for pump selection module
 */

interface PumpState {
  // User profile
  age?: number;
  diabetesType?: string;
  diagnosisYear?: number;
  currentTreatment?: string;

  // Preferences
  techSavvy?: number;
  lifestyle?: string;
  priorities?: string[];

  // Medical data (PHI)
  a1c?: number;
  complications?: string[];
  insurance?: string;

  // Rankings and results
  pumpRankings?: any;
  selectedPump?: string;
  chatHistory?: any[];
}

export class PumpSecureStorage {
  private static readonly SESSION_KEY = 'pump_session_id';

  /**
   * Load pump state from secure storage
   */
  static async loadState(patientId?: string): Promise<PumpState> {
    try {
      // Get session ID
      const sessionId =
        sessionStorage.getItem(this.SESSION_KEY) ||
        `pump_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.SESSION_KEY, sessionId);

      if (!patientId) {
        // Try to get from session
        const sessionData = sessionStorage.getItem('pump_temp_state');
        return sessionData ? JSON.parse(sessionData) : {};
      }

      // Load from server
      const response = await fetch('/api/secure-storage/pump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load',
          patientId,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load pump state');
      }

      return await response.json();
    } catch (error) {
      logError('App', 'Error message', {});
      return {};
    }
  }

  /**
   * Save pump state to secure storage
   */
  static async saveState(state: PumpState, patientId?: string): Promise<void> {
    try {
      const sessionId = sessionStorage.getItem(this.SESSION_KEY);

      if (!patientId) {
        // Save temporarily in session storage
        sessionStorage.setItem('pump_temp_state', JSON.stringify(state));
        return;
      }

      // Save to server
      const response = await fetch('/api/secure-storage/pump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          patientId,
          sessionId,
          data: state,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save pump state');
      }
    } catch (error) {
      logError('App', 'Error message', {});
      // Fallback to session storage
      sessionStorage.setItem('pump_temp_state', JSON.stringify(state));
    }
  }

  /**
   * Clear pump state
   */
  static async clearState(patientId?: string): Promise<void> {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem('pump_temp_state');

    if (patientId) {
      try {
        await fetch('/api/secure-storage/pump', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            patientId,
          }),
        });
      } catch (error) {
        logError('App', 'Error message', {});
      }
    }
  }

  /**
   * Migrate old localStorage data
   */
  static async migrateOldData(): Promise<void> {
    const oldKeys = ['guided_pump_state', 'pump_rank_state'];

    for (const key of oldKeys) {
      const oldData = localStorage.getItem(key);
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);
          await this.saveState(parsed);
          localStorage.removeItem(key);
          logDebug('App', 'Debug message', {});
        } catch (error) {
          logError('App', 'Error message', {});
        }
      }
    }
  }
}

// Auto-migrate on load
if (typeof window !== 'undefined') {
  PumpSecureStorage.migrateOldData().catch(console.error);
}
