import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * PumpDrive Data Persistence Service
 * Handles saving and retrieving conversation data from backend APIs
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3004/api';

interface CategoryResponse {
  category: string;
  mainTranscript: string;
  followUpTranscript: string;
  checkedQuestions: string[];
  timestamp: number;
}

interface ConversationSession {
  sessionId: string;
  categoryResponses: Record<string, CategoryResponse>;
  currentCategory?: string;
  completedCategories: string[];
  aiRecommendation?: any;
}

interface SaveSessionResponse {
  success: boolean;
  sessionId: string;
  timestamp: string;
}

class PumpDataPersistenceService {
  private sessionId: string;

  constructor() {
    // Generate or retrieve session ID
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Get or create a unique session ID for this browser session
   */
  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('pumpdrive_session_id');

    if (!sessionId) {
      sessionId = `pumpdrive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('pumpdrive_session_id', sessionId);
    }

    return sessionId;
  }

  /**
   * Save conversation session data to backend
   */
  async saveConversationSession(
    categoryResponses: Record<string, CategoryResponse>,
    currentCategory?: string,
    completedCategories: string[] = []
  ): Promise<SaveSessionResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/pump-conversation/save-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          categoryResponses,
          currentCategory,
          completedCategories,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Also save to sessionStorage as backup
      this.saveToSessionStorage(categoryResponses, currentCategory, completedCategories);

      return result;
    } catch (error) {
      logWarn('pumpDataPersistence', 'Warning message', {});

      // Fallback to sessionStorage only
      this.saveToSessionStorage(categoryResponses, currentCategory, completedCategories);

      return {
        success: true,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get conversation session data from backend
   */
  async getConversationSession(): Promise<ConversationSession | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/pump-conversation/get-session/${this.sessionId}`
      );

      if (response.status === 404) {
        // Session not found in backend, try sessionStorage
        return this.getFromSessionStorage();
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const session = await response.json();
      return {
        sessionId: session.sessionId,
        categoryResponses: session.categoryResponses || {},
        currentCategory: session.currentCategory,
        completedCategories: session.completedCategories || [],
        aiRecommendation: session.aiRecommendation,
      };
    } catch (error) {
      logWarn('pumpDataPersistence', 'Warning message', {});
      return this.getFromSessionStorage();
    }
  }

  /**
   * Save AI recommendation to session
   */
  async saveAIRecommendation(recommendation: any): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/pump-conversation/save-recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          recommendation,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Also save to sessionStorage
      sessionStorage.setItem('pumpdrive_recommendation', JSON.stringify(recommendation));
      sessionStorage.setItem('pumpdrive_recommendation_timestamp', Date.now().toString());

      return true;
    } catch (error) {
      logWarn('pumpDataPersistence', 'Warning message', {});

      // Fallback to sessionStorage
      sessionStorage.setItem('pumpdrive_recommendation', JSON.stringify(recommendation));
      sessionStorage.setItem('pumpdrive_recommendation_timestamp', Date.now().toString());

      return false; // Indicate backend save failed
    }
  }

  /**
   * Get AI recommendation from session
   */
  getAIRecommendation(): any | null {
    try {
      const recommendation = sessionStorage.getItem('pumpdrive_recommendation');
      return recommendation ? JSON.parse(recommendation) : null;
    } catch (error) {
      logError('pumpDataPersistence', 'Error message', {});
      return null;
    }
  }

  /**
   * Save to sessionStorage as backup
   */
  private saveToSessionStorage(
    categoryResponses: Record<string, CategoryResponse>,
    currentCategory?: string,
    completedCategories: string[] = []
  ): void {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        categoryResponses,
        currentCategory,
        completedCategories,
        timestamp: Date.now(),
      };

      sessionStorage.setItem('pumpdrive_session', JSON.stringify(sessionData));
    } catch (error) {
      logError('pumpDataPersistence', 'Error message', {});
    }
  }

  /**
   * Get from sessionStorage as fallback
   */
  private getFromSessionStorage(): ConversationSession | null {
    try {
      const sessionData = sessionStorage.getItem('pumpdrive_session');
      if (!sessionData) return null;

      const parsed = JSON.parse(sessionData);
      return {
        sessionId: parsed.sessionId || this.sessionId,
        categoryResponses: parsed.categoryResponses || {},
        currentCategory: parsed.currentCategory,
        completedCategories: parsed.completedCategories || [],
      };
    } catch (error) {
      logError('pumpDataPersistence', 'Error message', {});
      return null;
    }
  }

  /**
   * Clear all session data
   */
  clearSession(): void {
    sessionStorage.removeItem('pumpdrive_session');
    sessionStorage.removeItem('pumpdrive_session_id');
    sessionStorage.removeItem('pumpdrive_recommendation');
    sessionStorage.removeItem('pumpdrive_recommendation_timestamp');

    // Generate new session ID
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if session has data
   */
  hasSessionData(): boolean {
    const sessionData = sessionStorage.getItem('pumpdrive_session');
    return !!sessionData;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    sessionId: string;
    hasData: boolean;
    categoriesCount: number;
    completedCount: number;
    hasRecommendation: boolean;
  } {
    const session = this.getFromSessionStorage();
    const recommendation = this.getAIRecommendation();

    return {
      sessionId: this.sessionId,
      hasData: !!session,
      categoriesCount: session ? Object.keys(session.categoryResponses).length : 0,
      completedCount: session ? session.completedCategories.length : 0,
      hasRecommendation: !!recommendation,
    };
  }
}

export const pumpDataPersistenceService = new PumpDataPersistenceService();
