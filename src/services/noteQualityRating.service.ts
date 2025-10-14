/**
 * Note Quality Rating Service
 * Manages quality ratings, analytics, and feedback
 */

import { logDebug, logInfo, logWarn, logError } from './logger.service';
import { promptVersionControlService } from './promptVersionControl.service';
import type { QualityRating } from '../components/NoteQualityRating';

export interface QualityMetrics {
  totalRatings: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  thumbsUpCount: number;
  thumbsDownCount: number;
  thumbsUpPercentage: number;
  issueFrequency: Record<string, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  qualityScore: number; // 0-1 normalized score
}

export interface TemplateQualityReport {
  templateId: string;
  templateName?: string;
  metrics: QualityMetrics;
  sampleSize: number;
  lastUpdated: string;
  recommendations: string[];
}

export interface RatingWithContext extends QualityRating {
  id: string;
  doctorId?: string;
  patientId?: string;
}

class NoteQualityRatingService {
  private readonly STORAGE_KEY = 'note_quality_ratings';
  private readonly MAX_RATINGS = 1000;

  /**
   * Submit a quality rating
   */
  submitRating(rating: QualityRating, doctorId?: string, patientId?: string): string {
    const ratingWithContext: RatingWithContext = {
      ...rating,
      id: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      doctorId,
      patientId
    };

    // Store rating
    const ratings = this.getRatings();
    ratings.unshift(ratingWithContext);

    // Keep only recent ratings
    if (ratings.length > this.MAX_RATINGS) {
      ratings.length = this.MAX_RATINGS;
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ratings));

    // Update prompt version performance if applicable
    if (rating.promptVersionId) {
      this.updatePromptVersionQuality(rating.promptVersionId, rating.rating / 5);
    }

    logInfo('noteQualityRating', 'Rating submitted', {
      ratingId: ratingWithContext.id,
      stars: rating.rating,
      thumbsUpDown: rating.thumbsUpDown,
      issueCount: rating.issues.length
    });

    return ratingWithContext.id;
  }

  /**
   * Get all ratings
   */
  getRatings(filters?: {
    templateId?: string;
    promptVersionId?: string;
    modelUsed?: string;
    minRating?: number;
    maxRating?: number;
    startDate?: Date;
    endDate?: Date;
  }): RatingWithContext[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];

    try {
      let ratings: RatingWithContext[] = JSON.parse(stored);

      // Apply filters
      if (filters) {
        if (filters.templateId) {
          ratings = ratings.filter(r => r.templateId === filters.templateId);
        }
        if (filters.promptVersionId) {
          ratings = ratings.filter(r => r.promptVersionId === filters.promptVersionId);
        }
        if (filters.modelUsed) {
          ratings = ratings.filter(r => r.modelUsed === filters.modelUsed);
        }
        if (filters.minRating !== undefined) {
          ratings = ratings.filter(r => r.rating >= filters.minRating!);
        }
        if (filters.maxRating !== undefined) {
          ratings = ratings.filter(r => r.rating <= filters.maxRating!);
        }
        if (filters.startDate) {
          ratings = ratings.filter(r => new Date(r.timestamp) >= filters.startDate!);
        }
        if (filters.endDate) {
          ratings = ratings.filter(r => new Date(r.timestamp) <= filters.endDate!);
        }
      }

      return ratings;
    } catch (error) {
      logError('noteQualityRating', 'Failed to load ratings', { error });
      return [];
    }
  }

  /**
   * Get rating by ID
   */
  getRating(ratingId: string): RatingWithContext | null {
    const ratings = this.getRatings();
    return ratings.find(r => r.id === ratingId) || null;
  }

  /**
   * Calculate quality metrics for a set of ratings
   */
  calculateMetrics(ratings: RatingWithContext[]): QualityMetrics {
    if (ratings.length === 0) {
      return {
        totalRatings: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        thumbsUpCount: 0,
        thumbsDownCount: 0,
        thumbsUpPercentage: 0,
        issueFrequency: {},
        recentTrend: 'stable',
        qualityScore: 0
      };
    }

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    ratings.forEach(r => {
      distribution[r.rating as keyof typeof distribution]++;
      totalRating += r.rating;
    });

    const averageRating = totalRating / ratings.length;

    // Calculate thumbs up/down
    const thumbsUpCount = ratings.filter(r => r.thumbsUpDown === 'up').length;
    const thumbsDownCount = ratings.filter(r => r.thumbsUpDown === 'down').length;
    const thumbsTotal = thumbsUpCount + thumbsDownCount;
    const thumbsUpPercentage = thumbsTotal > 0 ? (thumbsUpCount / thumbsTotal) * 100 : 0;

    // Calculate issue frequency
    const issueFrequency: Record<string, number> = {};
    ratings.forEach(r => {
      r.issues.forEach(issue => {
        issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
      });
    });

    // Calculate recent trend
    const recentTrend = this.calculateTrend(ratings);

    // Calculate quality score (0-1)
    // Weighted: 70% star rating, 30% thumbs up/down
    const starScore = averageRating / 5;
    const thumbsScore = thumbsUpPercentage / 100;
    const qualityScore = (starScore * 0.7) + (thumbsScore * 0.3);

    return {
      totalRatings: ratings.length,
      averageRating,
      ratingDistribution: distribution,
      thumbsUpCount,
      thumbsDownCount,
      thumbsUpPercentage,
      issueFrequency,
      recentTrend,
      qualityScore
    };
  }

  /**
   * Calculate trend from recent ratings
   */
  private calculateTrend(ratings: RatingWithContext[]): 'improving' | 'declining' | 'stable' {
    if (ratings.length < 10) return 'stable';

    // Compare recent 20% vs previous 20%
    const recentCount = Math.floor(ratings.length * 0.2);
    const recent = ratings.slice(0, recentCount);
    const previous = ratings.slice(recentCount, recentCount * 2);

    const recentAvg = recent.reduce((sum, r) => sum + r.rating, 0) / recent.length;
    const previousAvg = previous.reduce((sum, r) => sum + r.rating, 0) / previous.length;

    const diff = recentAvg - previousAvg;

    if (diff > 0.3) return 'improving';
    if (diff < -0.3) return 'declining';
    return 'stable';
  }

  /**
   * Get quality report for a template
   */
  getTemplateQualityReport(templateId: string, templateName?: string): TemplateQualityReport {
    const ratings = this.getRatings({ templateId });
    const metrics = this.calculateMetrics(ratings);

    // Generate recommendations based on metrics
    const recommendations: string[] = [];

    if (metrics.averageRating < 3.5) {
      recommendations.push('Consider reviewing and updating template instructions');
    }

    if (metrics.thumbsDownCount > metrics.thumbsUpCount) {
      recommendations.push('High negative feedback - investigate common issues');
    }

    // Check for frequent issues
    const topIssues = Object.entries(metrics.issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topIssues.forEach(([issue, count]) => {
      if (count > ratings.length * 0.3) {
        recommendations.push(`Address frequent issue: ${issue.replace(/-/g, ' ')}`);
      }
    });

    if (metrics.recentTrend === 'declining') {
      recommendations.push('Quality declining - recent prompt changes may need review');
    }

    if (ratings.length < 5) {
      recommendations.push('Insufficient data - collect more ratings for reliable metrics');
    }

    return {
      templateId,
      templateName,
      metrics,
      sampleSize: ratings.length,
      lastUpdated: new Date().toISOString(),
      recommendations
    };
  }

  /**
   * Get quality comparison between templates
   */
  compareTemplates(templateIds: string[]): {
    templates: TemplateQualityReport[];
    bestTemplate: string;
    insights: string[];
  } {
    const reports = templateIds.map(id => this.getTemplateQualityReport(id));

    // Find best template
    let bestTemplate = templateIds[0];
    let bestScore = 0;

    reports.forEach((report) => {
      if (report.metrics.qualityScore > bestScore) {
        bestScore = report.metrics.qualityScore;
        bestTemplate = report.templateId;
      }
    });

    // Generate insights
    const insights: string[] = [];

    const avgQuality = reports.reduce((sum, r) => sum + r.metrics.qualityScore, 0) / reports.length;
    insights.push(`Average quality score across templates: ${(avgQuality * 100).toFixed(1)}%`);

    const improvingCount = reports.filter(r => r.metrics.recentTrend === 'improving').length;
    const decliningCount = reports.filter(r => r.metrics.recentTrend === 'declining').length;

    if (improvingCount > 0) {
      insights.push(`${improvingCount} template(s) showing improvement`);
    }
    if (decliningCount > 0) {
      insights.push(`${decliningCount} template(s) showing decline - needs attention`);
    }

    return {
      templates: reports,
      bestTemplate,
      insights
    };
  }

  /**
   * Get quality metrics for a prompt version
   */
  getPromptVersionQuality(promptVersionId: string): QualityMetrics {
    const ratings = this.getRatings({ promptVersionId });
    return this.calculateMetrics(ratings);
  }

  /**
   * Update prompt version quality score
   */
  private updatePromptVersionQuality(promptVersionId: string, normalizedScore: number): void {
    // This integrates with the prompt version control service
    const version = promptVersionControlService.getVersion(promptVersionId);
    if (version && version.performance) {
      const oldScore = version.performance.averageQualityScore;
      const oldCount = version.performance.usageCount;

      // Update running average
      const newScore = ((oldScore * oldCount) + normalizedScore) / (oldCount + 1);

      promptVersionControlService.updateVersion(promptVersionId, {
        performance: {
          ...version.performance,
          averageQualityScore: newScore
        }
      });

      logDebug('noteQualityRating', 'Updated prompt version quality', {
        promptVersionId,
        newScore: newScore.toFixed(3)
      });
    }
  }

  /**
   * Get top issues across all ratings
   */
  getTopIssues(limit: number = 10): Array<{ issue: string; count: number; percentage: number }> {
    const allRatings = this.getRatings();
    const metrics = this.calculateMetrics(allRatings);

    const issues = Object.entries(metrics.issueFrequency)
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: (count / allRatings.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return issues;
  }

  /**
   * Get ratings summary by model
   */
  getModelComparison(): Array<{
    model: string;
    metrics: QualityMetrics;
    sampleSize: number;
  }> {
    const allRatings = this.getRatings();
    const modelGroups: Record<string, RatingWithContext[]> = {};

    allRatings.forEach(rating => {
      if (rating.modelUsed) {
        if (!modelGroups[rating.modelUsed]) {
          modelGroups[rating.modelUsed] = [];
        }
        modelGroups[rating.modelUsed].push(rating);
      }
    });

    return Object.entries(modelGroups).map(([model, ratings]) => ({
      model,
      metrics: this.calculateMetrics(ratings),
      sampleSize: ratings.length
    }));
  }

  /**
   * Export ratings to CSV
   */
  exportToCSV(): string {
    const ratings = this.getRatings();

    const headers = [
      'ID',
      'Note ID',
      'Rating',
      'Thumbs Up/Down',
      'Issues',
      'Feedback',
      'Timestamp',
      'Template ID',
      'Prompt Version ID',
      'Model Used'
    ];

    const rows = ratings.map(r => [
      r.id,
      r.noteId,
      r.rating.toString(),
      r.thumbsUpDown || '',
      r.issues.join('; '),
      r.feedback || '',
      r.timestamp,
      r.templateId || '',
      r.promptVersionId || '',
      r.modelUsed || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Clear old ratings (older than specified days)
   */
  clearOldRatings(daysToKeep: number = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const allRatings = this.getRatings();
    const filteredRatings = allRatings.filter(
      r => new Date(r.timestamp) >= cutoffDate
    );

    const removedCount = allRatings.length - filteredRatings.length;

    if (removedCount > 0) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredRatings));
      logInfo('noteQualityRating', 'Cleared old ratings', {
        removed: removedCount,
        remaining: filteredRatings.length
      });
    }

    return removedCount;
  }

  /**
   * Get daily quality trend
   */
  getDailyTrend(days: number = 30): Array<{
    date: string;
    averageRating: number;
    count: number;
  }> {
    const ratings = this.getRatings();
    const dailyData: Record<string, { total: number; count: number }> = {};

    ratings.forEach(rating => {
      const date = new Date(rating.timestamp).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, count: 0 };
      }
      dailyData[date].total += rating.rating;
      dailyData[date].count++;
    });

    const trend = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        averageRating: data.total / data.count,
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);

    return trend;
  }
}

export const noteQualityRatingService = new NoteQualityRatingService();
