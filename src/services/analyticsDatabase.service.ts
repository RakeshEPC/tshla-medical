/**
 * Analytics Database Service
 * Integrates with Supabase analytics tables for persistent storage
 */

import { supabase } from '../lib/supabase';
import { logDebug, logInfo, logWarn, logError } from './logger.service';
import type { QualityRating } from '../components/NoteQualityRating';

export interface TemplateAnalytics {
  id: string;
  template_id: string;
  staff_id?: string;
  total_uses: number;
  successful_uses: number;
  failed_uses: number;
  success_rate: number;
  average_quality_rating: number;
  total_ratings: number;
  thumbs_up_count: number;
  thumbs_down_count: number;
  avg_processing_time_ms: number;
  avg_token_usage: number;
  avg_token_cost: number;
  complexity_score: number;
  complexity_level: string;
  recommended_model: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'all_time';
  period_start: string;
  period_end?: string;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  version: string;
  name: string;
  description?: string;
  prompt_type: 'system' | 'custom-template' | 'standard-template' | 'conversational';
  prompt_template: string;
  variables: string[];
  status: 'draft' | 'active' | 'testing' | 'deprecated' | 'archived';
  parent_version_id?: string;
  changes?: string;
  target_models: string[];
  estimated_tokens: number;
  complexity: string;
  tags: string[];
  usage_count: number;
  success_rate: number;
  avg_quality_score: number;
  avg_processing_time_ms: number;
  avg_token_usage: number;
  ab_test_enabled: boolean;
  ab_test_traffic_percentage: number;
  ab_test_control_version_id?: string;
  ab_test_group?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface NoteQualityRatingDB {
  id: string;
  note_id: string;
  staff_id?: string;
  patient_id?: string;
  star_rating: number;
  thumbs_up_down?: 'up' | 'down';
  issues: string[];
  feedback_text?: string;
  template_id?: string;
  prompt_version_id?: string;
  model_used?: string;
  timestamp: string;
}

export interface TokenUsageLog {
  id: string;
  note_id?: string;
  staff_id?: string;
  template_id?: string;
  prompt_version_id?: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_tokens?: number;
  token_estimate_accuracy?: number;
  truncation_applied: boolean;
  tokens_truncated: number;
  input_cost?: number;
  output_cost?: number;
  total_cost?: number;
  processing_time_ms?: number;
  timestamp: string;
}

class AnalyticsDatabaseService {
  /**
   * Save quality rating to database
   */
  async saveQualityRating(
    rating: QualityRating,
    staffId?: string,
    patientId?: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('note_quality_ratings')
        .insert({
          note_id: rating.noteId,
          staff_id: staffId,
          patient_id: patientId,
          star_rating: rating.rating,
          thumbs_up_down: rating.thumbsUpDown,
          issues: rating.issues,
          feedback_text: rating.feedback,
          template_id: rating.templateId,
          prompt_version_id: rating.promptVersionId,
          model_used: rating.modelUsed,
          timestamp: rating.timestamp
        })
        .select('id')
        .single();

      if (error) {
        logError('analyticsDB', 'Failed to save quality rating', { error });
        return null;
      }

      logInfo('analyticsDB', 'Quality rating saved', { id: data.id });
      return data.id;
    } catch (error) {
      logError('analyticsDB', 'Exception saving quality rating', { error });
      return null;
    }
  }

  /**
   * Get quality ratings with filters
   */
  async getQualityRatings(filters: {
    templateId?: string;
    promptVersionId?: string;
    staffId?: string;
    minRating?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<NoteQualityRatingDB[]> {
    try {
      let query = supabase
        .from('note_quality_ratings')
        .select('*')
        .order('timestamp', { ascending: false });

      if (filters.templateId) {
        query = query.eq('template_id', filters.templateId);
      }
      if (filters.promptVersionId) {
        query = query.eq('prompt_version_id', filters.promptVersionId);
      }
      if (filters.staffId) {
        query = query.eq('staff_id', filters.staffId);
      }
      if (filters.minRating !== undefined) {
        query = query.gte('star_rating', filters.minRating);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        logError('analyticsDB', 'Failed to get quality ratings', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logError('analyticsDB', 'Exception getting quality ratings', { error });
      return [];
    }
  }

  /**
   * Save prompt version to database
   */
  async savePromptVersion(version: Omit<PromptVersion, 'id' | 'created_at' | 'updated_at'>): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('prompt_versions')
        .insert({
          version: version.version,
          name: version.name,
          description: version.description,
          prompt_type: version.prompt_type,
          prompt_template: version.prompt_template,
          variables: version.variables,
          status: version.status,
          parent_version_id: version.parent_version_id,
          changes: version.changes,
          target_models: version.target_models,
          estimated_tokens: version.estimated_tokens,
          complexity: version.complexity,
          tags: version.tags,
          usage_count: version.usage_count,
          success_rate: version.success_rate,
          avg_quality_score: version.avg_quality_score,
          avg_processing_time_ms: version.avg_processing_time_ms,
          avg_token_usage: version.avg_token_usage,
          ab_test_enabled: version.ab_test_enabled,
          ab_test_traffic_percentage: version.ab_test_traffic_percentage,
          ab_test_control_version_id: version.ab_test_control_version_id,
          ab_test_group: version.ab_test_group,
          created_by: version.created_by
        })
        .select('id')
        .single();

      if (error) {
        logError('analyticsDB', 'Failed to save prompt version', { error });
        return null;
      }

      logInfo('analyticsDB', 'Prompt version saved', { id: data.id });
      return data.id;
    } catch (error) {
      logError('analyticsDB', 'Exception saving prompt version', { error });
      return null;
    }
  }

  /**
   * Update prompt version performance metrics
   */
  async updatePromptVersionMetrics(
    versionId: string,
    metrics: {
      usage_count?: number;
      success_rate?: number;
      avg_quality_score?: number;
      avg_processing_time_ms?: number;
      avg_token_usage?: number;
      last_used_at?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('prompt_versions')
        .update(metrics)
        .eq('id', versionId);

      if (error) {
        logError('analyticsDB', 'Failed to update prompt version metrics', { error });
        return false;
      }

      return true;
    } catch (error) {
      logError('analyticsDB', 'Exception updating prompt version metrics', { error });
      return false;
    }
  }

  /**
   * Get active prompt versions by type
   */
  async getActivePromptVersions(
    promptType: 'system' | 'custom-template' | 'standard-template' | 'conversational'
  ): Promise<PromptVersion[]> {
    try {
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('prompt_type', promptType)
        .in('status', ['active', 'testing'])
        .order('created_at', { ascending: false });

      if (error) {
        logError('analyticsDB', 'Failed to get active prompt versions', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logError('analyticsDB', 'Exception getting active prompt versions', { error });
      return [];
    }
  }

  /**
   * Log token usage
   */
  async logTokenUsage(log: Omit<TokenUsageLog, 'id' | 'timestamp'>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('token_usage_log')
        .insert({
          note_id: log.note_id,
          staff_id: log.staff_id,
          template_id: log.template_id,
          prompt_version_id: log.prompt_version_id,
          model_name: log.model_name,
          input_tokens: log.input_tokens,
          output_tokens: log.output_tokens,
          total_tokens: log.total_tokens,
          estimated_tokens: log.estimated_tokens,
          token_estimate_accuracy: log.token_estimate_accuracy,
          truncation_applied: log.truncation_applied,
          tokens_truncated: log.tokens_truncated,
          input_cost: log.input_cost,
          output_cost: log.output_cost,
          total_cost: log.total_cost,
          processing_time_ms: log.processing_time_ms
        });

      if (error) {
        logError('analyticsDB', 'Failed to log token usage', { error });
        return false;
      }

      return true;
    } catch (error) {
      logError('analyticsDB', 'Exception logging token usage', { error });
      return false;
    }
  }

  /**
   * Get token usage summary
   */
  async getTokenUsageSummary(filters: {
    staffId?: string;
    templateId?: string;
    modelName?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    avgTokensPerRequest: number;
    avgCostPerRequest: number;
  }> {
    try {
      let query = supabase
        .from('token_usage_log')
        .select('total_tokens, total_cost');

      if (filters.staffId) {
        query = query.eq('staff_id', filters.staffId);
      }
      if (filters.templateId) {
        query = query.eq('template_id', filters.templateId);
      }
      if (filters.modelName) {
        query = query.eq('model_name', filters.modelName);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error || !data) {
        logError('analyticsDB', 'Failed to get token usage summary', { error });
        return {
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0,
          avgTokensPerRequest: 0,
          avgCostPerRequest: 0
        };
      }

      const totalTokens = data.reduce((sum, row) => sum + (row.total_tokens || 0), 0);
      const totalCost = data.reduce((sum, row) => sum + (row.total_cost || 0), 0);
      const requestCount = data.length;

      return {
        totalTokens,
        totalCost,
        requestCount,
        avgTokensPerRequest: requestCount > 0 ? totalTokens / requestCount : 0,
        avgCostPerRequest: requestCount > 0 ? totalCost / requestCount : 0
      };
    } catch (error) {
      logError('analyticsDB', 'Exception getting token usage summary', { error });
      return {
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        avgTokensPerRequest: 0,
        avgCostPerRequest: 0
      };
    }
  }

  /**
   * Get template performance summary
   */
  async getTemplatePerformanceSummary(templateId: string): Promise<TemplateAnalytics | null> {
    try {
      const { data, error } = await supabase
        .from('template_analytics')
        .select('*')
        .eq('template_id', templateId)
        .eq('period_type', 'all_time')
        .single();

      if (error) {
        logError('analyticsDB', 'Failed to get template performance', { error });
        return null;
      }

      return data;
    } catch (error) {
      logError('analyticsDB', 'Exception getting template performance', { error });
      return null;
    }
  }

  /**
   * Update template analytics
   */
  async updateTemplateAnalytics(
    templateId: string,
    periodType: 'daily' | 'weekly' | 'monthly' | 'all_time',
    periodStart: Date,
    updates: Partial<Omit<TemplateAnalytics, 'id' | 'template_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('template_analytics')
        .select('id')
        .eq('template_id', templateId)
        .eq('period_type', periodType)
        .eq('period_start', periodStart.toISOString())
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('template_analytics')
          .update(updates)
          .eq('id', existing.id);

        if (error) {
          logError('analyticsDB', 'Failed to update template analytics', { error });
          return false;
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('template_analytics')
          .insert({
            template_id: templateId,
            period_type: periodType,
            period_start: periodStart.toISOString(),
            ...updates
          });

        if (error) {
          logError('analyticsDB', 'Failed to insert template analytics', { error });
          return false;
        }
      }

      return true;
    } catch (error) {
      logError('analyticsDB', 'Exception updating template analytics', { error });
      return false;
    }
  }

  /**
   * Get daily quality trend from view
   */
  async getDailyQualityTrend(days: number = 30): Promise<Array<{
    date: string;
    rating_count: number;
    avg_rating: number;
    thumbs_up: number;
    thumbs_down: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('daily_quality_trend')
        .select('*')
        .limit(days);

      if (error) {
        logError('analyticsDB', 'Failed to get daily quality trend', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logError('analyticsDB', 'Exception getting daily quality trend', { error });
      return [];
    }
  }

  /**
   * Get model comparison from view
   */
  async getModelComparison(): Promise<Array<{
    model_name: string;
    total_requests: number;
    avg_success_rate: number;
    avg_processing_time: number;
    total_tokens: number;
    total_cost: number;
    avg_quality: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('model_comparison')
        .select('*')
        .order('avg_quality', { ascending: false });

      if (error) {
        logError('analyticsDB', 'Failed to get model comparison', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logError('analyticsDB', 'Exception getting model comparison', { error });
      return [];
    }
  }

  /**
   * Get template performance summary from view
   */
  async getTemplatePerformanceSummaries(): Promise<Array<{
    template_id: string;
    template_name: string;
    template_type: string;
    total_uses: number;
    success_rate: number;
    average_quality_rating: number;
    avg_processing_time_ms: number;
    avg_token_cost: number;
    complexity_level: string;
    recommended_model: string;
    last_updated: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('template_performance_summary')
        .select('*');

      if (error) {
        logError('analyticsDB', 'Failed to get template performance summaries', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logError('analyticsDB', 'Exception getting template performance summaries', { error });
      return [];
    }
  }
}

export const analyticsDatabaseService = new AnalyticsDatabaseService();
