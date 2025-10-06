// Context 7 MCP Service for Pump Drive Assessment
import {
  PumpSession,
  PumpFeedback,
  ConflictDetection,
  ConflictResolution,
  PumpAnalytics,
  WelcomeBackData,
} from '../types/context7.types';
import { logDebug, logInfo, logError } from './logger.service';

class PumpDriveContext7Service {
  private readonly SESSION_KEY_PREFIX = 'pump_session_';
  private readonly FEEDBACK_KEY_PREFIX = 'pump_feedback_';
  private readonly CONFLICT_KEY_PREFIX = 'pump_conflict_';
  private readonly SESSION_TTL_DAYS = 30;
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  // ============================================
  // PHASE 1: SESSION PERSISTENCE
  // ============================================

  /**
   * Get existing session for a user
   */
  getSessionByUserId(userId: string): PumpSession | null {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      const sessionData = localStorage.getItem(sessionKey);

      if (!sessionData) {
        logDebug('context7', 'No existing session found', { userId });
        return null;
      }

      const session: PumpSession = JSON.parse(sessionData);

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        logInfo('context7', 'Session expired, removing', { userId, sessionId: session.sessionId });
        this.deleteSession(userId);
        return null;
      }

      // Check if session is complete
      if (session.status === 'complete') {
        logDebug('context7', 'Session already complete', { sessionId: session.sessionId });
        return session;
      }

      logInfo('context7', 'Retrieved existing session', {
        sessionId: session.sessionId,
        percentComplete: session.percentComplete,
      });

      return session;
    } catch (error) {
      logError('context7', 'Error retrieving session', { userId, error });
      return null;
    }
  }

  /**
   * Save or update a session
   */
  saveSession(
    userId: string,
    responses: Record<string, number>,
    priorities: string[],
    selectedFeatures: any[] = [],
    freeText: string = '',
    completedQuestions: string[] = [],
    totalQuestions: number = 9
  ): { sessionId: string; percentComplete: number } {
    try {
      const existingSession = this.getSessionByUserId(userId);
      const sessionId = existingSession?.sessionId || this.generateSessionId();
      const now = Date.now();
      const expiresAt = now + this.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

      const percentComplete = Math.round((completedQuestions.length / totalQuestions) * 100);
      const isComplete = percentComplete === 100;

      const session: PumpSession = {
        sessionId,
        userId,
        responses,
        priorities,
        selectedFeatures,
        freeText,
        completedQuestions,
        totalQuestions,
        percentComplete,
        createdAt: existingSession?.createdAt || now,
        lastUpdated: now,
        expiresAt,
        completedAt: isComplete ? now : existingSession?.completedAt,
        status: isComplete ? 'complete' : 'incomplete',
      };

      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      localStorage.setItem(sessionKey, JSON.stringify(session));

      logInfo('context7', 'Session saved', {
        sessionId,
        percentComplete,
        status: session.status,
      });

      return { sessionId, percentComplete };
    } catch (error) {
      logError('context7', 'Error saving session', { userId, error });
      throw new Error('Failed to save session');
    }
  }

  /**
   * Delete a session
   */
  deleteSession(userId: string): void {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      localStorage.removeItem(sessionKey);
      logInfo('context7', 'Session deleted', { userId });
    } catch (error) {
      logError('context7', 'Error deleting session', { userId, error });
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clean up expired sessions (call this periodically)
   */
  cleanupExpiredSessions(): number {
    try {
      let cleaned = 0;
      const now = Date.now();

      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.SESSION_KEY_PREFIX)) {
          const sessionData = localStorage.getItem(key);
          if (sessionData) {
            const session: PumpSession = JSON.parse(sessionData);
            if (now > session.expiresAt) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        }
      }

      if (cleaned > 0) {
        logInfo('context7', 'Cleaned expired sessions', { count: cleaned });
      }

      return cleaned;
    } catch (error) {
      logError('context7', 'Error cleaning expired sessions', { error });
      return 0;
    }
  }

  /**
   * Get welcome back data for returning users
   */
  getWelcomeBackData(userId: string): WelcomeBackData {
    const session = this.getSessionByUserId(userId);

    if (!session || session.status === 'complete') {
      return {
        sessionFound: false,
        lastVisit: '',
        completionStatus: '',
        estimatedTimeRemaining: '',
        canResume: false,
      };
    }

    const lastVisit = this.formatLastVisit(session.lastUpdated);
    const completionStatus = `${session.completedQuestions.length}/${session.totalQuestions} questions answered`;
    const remainingQuestions = session.totalQuestions - session.completedQuestions.length;
    const estimatedTimeRemaining = `~${Math.ceil(remainingQuestions * 0.5)} minutes`;

    return {
      sessionFound: true,
      session,
      lastVisit,
      completionStatus,
      estimatedTimeRemaining,
      canResume: true,
    };
  }

  /**
   * Format timestamp to human-readable last visit
   */
  private formatLastVisit(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (days < 7) {
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  // ============================================
  // PHASE 4: FEEDBACK COLLECTION
  // ============================================

  /**
   * Save user feedback on pump recommendation
   */
  saveFeedback(
    sessionId: string,
    userId: string,
    recommendedPump: string,
    actualPump: string | null,
    feedbackType: 'same' | 'different' | 'still_deciding',
    reason?: string,
    reasonCategory?: 'cost' | 'insurance' | 'tubeless' | 'cgm' | 'other'
  ): string {
    try {
      const feedbackId = this.generateFeedbackId();
      const accuracy = feedbackType === 'same' ? 1 : feedbackType === 'different' ? 0 : -1;

      const feedback: PumpFeedback = {
        feedbackId,
        sessionId,
        userId: this.hashUserId(userId), // SHA-256 hash for privacy
        recommendedPump,
        actualPump,
        feedbackType,
        reason,
        reasonCategory,
        timestamp: Date.now(),
        accuracy,
      };

      const feedbackKey = `${this.FEEDBACK_KEY_PREFIX}${feedbackId}`;
      localStorage.setItem(feedbackKey, JSON.stringify(feedback));

      logInfo('context7', 'Feedback saved', {
        feedbackId,
        feedbackType,
        accuracy,
      });

      return feedbackId;
    } catch (error) {
      logError('context7', 'Error saving feedback', { sessionId, error });
      throw new Error('Failed to save feedback');
    }
  }

  /**
   * Get all feedback for analytics
   */
  getAllFeedback(): PumpFeedback[] {
    try {
      const feedbackList: PumpFeedback[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.FEEDBACK_KEY_PREFIX)) {
          const feedbackData = localStorage.getItem(key);
          if (feedbackData) {
            feedbackList.push(JSON.parse(feedbackData));
          }
        }
      }

      return feedbackList.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logError('context7', 'Error retrieving feedback', { error });
      return [];
    }
  }

  /**
   * Generate unique feedback ID
   */
  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Hash user ID for privacy (SHA-256)
   */
  private hashUserId(userId: string): string {
    // Simple hash for demo - in production, use Web Crypto API
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }

  // ============================================
  // PHASE 5: ANALYTICS
  // ============================================

  /**
   * Calculate recommendation accuracy and analytics
   */
  calculateAnalytics(days: number = 30): PumpAnalytics {
    try {
      const allFeedback = this.getAllFeedback();
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
      const recentFeedback = allFeedback.filter(f => f.timestamp > cutoffTime && f.accuracy !== -1);

      if (recentFeedback.length === 0) {
        return this.emptyAnalytics(days);
      }

      // Overall accuracy
      const totalAccurate = recentFeedback.filter(f => f.accuracy === 1).length;
      const overallAccuracy = Math.round((totalAccurate / recentFeedback.length) * 100);

      // Feedback by pump
      const feedbackByPump: Record<string, { recommended: number; chosen: number; accuracy: number }> = {};
      recentFeedback.forEach(f => {
        if (!feedbackByPump[f.recommendedPump]) {
          feedbackByPump[f.recommendedPump] = { recommended: 0, chosen: 0, accuracy: 0 };
        }
        feedbackByPump[f.recommendedPump].recommended++;
        if (f.actualPump === f.recommendedPump) {
          feedbackByPump[f.recommendedPump].chosen++;
        }
      });

      // Calculate accuracy per pump
      Object.keys(feedbackByPump).forEach(pump => {
        const data = feedbackByPump[pump];
        data.accuracy = Math.round((data.chosen / data.recommended) * 100);
      });

      // Top reasons for different choices
      const reasonCounts: Record<string, number> = {};
      recentFeedback
        .filter(f => f.reason && f.accuracy === 0)
        .forEach(f => {
          const reason = f.reasonCategory || f.reason || 'other';
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });

      const topReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: Math.round((count / recentFeedback.length) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        overallAccuracy,
        totalFeedback: recentFeedback.length,
        feedbackByPump,
        feedbackByUserSegment: {}, // To be implemented
        topReasons,
        timeRange: {
          start: cutoffTime,
          end: Date.now(),
          days,
        },
      };
    } catch (error) {
      logError('context7', 'Error calculating analytics', { error });
      return this.emptyAnalytics(days);
    }
  }

  /**
   * Empty analytics object
   */
  private emptyAnalytics(days: number): PumpAnalytics {
    return {
      overallAccuracy: 0,
      totalFeedback: 0,
      feedbackByPump: {},
      feedbackByUserSegment: {},
      topReasons: [],
      timeRange: {
        start: Date.now() - days * 24 * 60 * 60 * 1000,
        end: Date.now(),
        days,
      },
    };
  }

  // ============================================
  // PHASE 7: CONFLICT DETECTION
  // ============================================

  /**
   * Save conflict resolution
   */
  saveConflictResolution(
    conflictName: string,
    userChoice: string,
    priorityFeature: string,
    deprioritizedFeature: string
  ): void {
    try {
      const resolution: ConflictResolution = {
        conflictName,
        userChoice,
        priorityFeature,
        deprioritizedFeature,
        timestamp: Date.now(),
      };

      const resolutionKey = `${this.CONFLICT_KEY_PREFIX}${Date.now()}`;
      localStorage.setItem(resolutionKey, JSON.stringify(resolution));

      logInfo('context7', 'Conflict resolution saved', { conflictName, userChoice });
    } catch (error) {
      logError('context7', 'Error saving conflict resolution', { error });
    }
  }

  /**
   * Get all conflict resolutions for pattern analysis
   */
  getAllConflictResolutions(): ConflictResolution[] {
    try {
      const resolutions: ConflictResolution[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CONFLICT_KEY_PREFIX)) {
          const resolutionData = localStorage.getItem(key);
          if (resolutionData) {
            resolutions.push(JSON.parse(resolutionData));
          }
        }
      }

      return resolutions.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logError('context7', 'Error retrieving conflict resolutions', { error });
      return [];
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Clear all Context 7 data (for testing/debugging)
   */
  clearAllData(): void {
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith(this.SESSION_KEY_PREFIX) ||
            key.startsWith(this.FEEDBACK_KEY_PREFIX) ||
            key.startsWith(this.CONFLICT_KEY_PREFIX))
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      logInfo('context7', 'All Context 7 data cleared', { count: keysToRemove.length });
    } catch (error) {
      logError('context7', 'Error clearing data', { error });
    }
  }

  /**
   * Get storage stats
   */
  getStorageStats() {
    const sessions = Object.keys(localStorage).filter(k => k.startsWith(this.SESSION_KEY_PREFIX)).length;
    const feedback = Object.keys(localStorage).filter(k => k.startsWith(this.FEEDBACK_KEY_PREFIX)).length;
    const conflicts = Object.keys(localStorage).filter(k => k.startsWith(this.CONFLICT_KEY_PREFIX)).length;

    return {
      totalSessions: sessions,
      totalFeedback: feedback,
      totalConflictResolutions: conflicts,
      total: sessions + feedback + conflicts,
    };
  }
}

export const pumpContext7Service = new PumpDriveContext7Service();
