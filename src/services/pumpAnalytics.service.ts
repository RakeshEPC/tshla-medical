/**
 * Pump Analytics Service
 * Fetches aggregated analytics data for admin dashboard
 */

import { logError, logInfo } from './logger.service';

export interface PumpDistribution {
  pumpName: string;
  count: number;
  percentage: number;
  avgScore: number;
}

export interface AssessmentTrend {
  date: string;
  count: number;
}

export interface FlowTypeStats {
  flowType: string;
  count: number;
  percentage: number;
  avgScore: number;
}

export interface UserEngagement {
  totalUsers: number;
  completedAssessments: number;
  conversionRate: number;
  avgAssessmentsPerUser: number;
}

export interface AnalyticsSummary {
  totalAssessments: number;
  totalUsers: number;
  avgMatchScore: number;
  completionRate: number;
  lastUpdated: string;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  pumpDistribution: PumpDistribution[];
  assessmentTrends: AssessmentTrend[];
  flowTypeStats: FlowTypeStats[];
  userEngagement: UserEngagement;
  topPumps: PumpDistribution[];
  recentAssessments: RecentAssessment[];
}

export interface RecentAssessment {
  id: number;
  userId: number;
  username: string;
  completedAt: string;
  recommendedPump: string;
  matchScore: number;
  flowType: string;
}

class PumpAnalyticsService {
  private readonly API_BASE: string;

  constructor() {
    // Use environment variable or default to production URL
    this.API_BASE = import.meta.env.VITE_API_BASE_URL ||
      'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io';
  }

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
  }

  /**
   * Get comprehensive analytics data
   */
  async getAnalytics(): Promise<AnalyticsData> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.API_BASE}/api/admin/pumpdrive/analytics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const data = await response.json();
      logInfo('Analytics data fetched successfully');
      return data;
    } catch (error) {
      logError('Error fetching analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics summary (high-level metrics)
   */
  async getSummary(): Promise<AnalyticsSummary> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.API_BASE}/api/admin/pumpdrive/analytics/summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch summary: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logError('Error fetching summary:', error);
      throw error;
    }
  }

  /**
   * Get pump distribution data
   */
  async getPumpDistribution(): Promise<PumpDistribution[]> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.API_BASE}/api/admin/pumpdrive/analytics/pump-distribution`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pump distribution: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logError('Error fetching pump distribution:', error);
      throw error;
    }
  }

  /**
   * Get assessment trends over time
   */
  async getAssessmentTrends(days: number = 30): Promise<AssessmentTrend[]> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.API_BASE}/api/admin/pumpdrive/analytics/trends?days=${days}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trends: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logError('Error fetching trends:', error);
      throw error;
    }
  }

  /**
   * Get recent assessments for activity feed
   */
  async getRecentAssessments(limit: number = 10): Promise<RecentAssessment[]> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.API_BASE}/api/admin/pumpdrive/analytics/recent?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recent assessments: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logError('Error fetching recent assessments:', error);
      throw error;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Format score
   */
  formatScore(score: number): string {
    return `${score.toFixed(1)}%`;
  }
}

// Export singleton instance
export const pumpAnalyticsService = new PumpAnalyticsService();
