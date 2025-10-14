/**
 * Template Analytics Dashboard
 * Comprehensive analytics for template performance, quality, and usage
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  ThumbsUp,
  ThumbsDown,
  Clock,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle2,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { noteQualityRatingService } from '../services/noteQualityRating.service';
import { analyticsDatabaseService } from '../services/analyticsDatabase.service';
import type { TemplateQualityReport } from '../services/noteQualityRating.service';

interface DashboardStats {
  totalTemplates: number;
  totalRatings: number;
  averageQuality: number;
  topPerformer: string;
  improvingCount: number;
  decliningCount: number;
}

export const TemplateAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTemplates: 0,
    totalRatings: 0,
    averageQuality: 0,
    topPerformer: 'N/A',
    improvingCount: 0,
    decliningCount: 0
  });
  const [templateReports, setTemplateReports] = useState<TemplateQualityReport[]>([]);
  const [modelComparison, setModelComparison] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [topIssues, setTopIssues] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);

    try {
      // Load template performance summaries from database
      const dbSummaries = await analyticsDatabaseService.getTemplatePerformanceSummaries();

      // Get template IDs
      const templateIds = dbSummaries.map(s => s.template_id);

      // Generate reports for each template
      const reports = templateIds.map(id => {
        const summary = dbSummaries.find(s => s.template_id === id);
        return noteQualityRatingService.getTemplateQualityReport(
          id,
          summary?.template_name
        );
      });

      setTemplateReports(reports);

      // Calculate dashboard stats
      const totalRatings = reports.reduce((sum, r) => sum + r.sampleSize, 0);
      const avgQuality = reports.reduce((sum, r) => sum + r.metrics.averageRating, 0) / reports.length;
      const improvingCount = reports.filter(r => r.metrics.recentTrend === 'improving').length;
      const decliningCount = reports.filter(r => r.metrics.recentTrend === 'declining').length;

      const topReport = reports.sort((a, b) =>
        b.metrics.qualityScore - a.metrics.qualityScore
      )[0];

      setStats({
        totalTemplates: reports.length,
        totalRatings,
        averageQuality: avgQuality,
        topPerformer: topReport?.templateName || 'N/A',
        improvingCount,
        decliningCount
      });

      // Load model comparison
      const models = await analyticsDatabaseService.getModelComparison();
      setModelComparison(models);

      // Load daily trend
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const trend = noteQualityRatingService.getDailyTrend(days);
      setDailyTrend(trend);

      // Load top issues
      const issues = noteQualityRatingService.getTopIssues(5);
      setTopIssues(issues);

    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const exportData = () => {
    const csv = noteQualityRatingService.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Template Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Performance insights and quality metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <button
              onClick={loadAnalyticsData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Templates</span>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalTemplates}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {stats.improvingCount} improving, {stats.decliningCount} declining
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Quality</span>
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.averageQuality.toFixed(1)}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i <= Math.round(stats.averageQuality)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Ratings</span>
              <ThumbsUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalRatings}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Across all templates
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Top Performer</span>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {stats.topPerformer}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Highest quality score
            </div>
          </div>
        </div>

        {/* Quality Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quality Trend Over Time
          </h2>
          <div className="h-64 flex items-end justify-between gap-2">
            {dailyTrend.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{ height: `${(day.averageRating / 5) * 100}%` }}
                  title={`${day.date}: ${day.averageRating.toFixed(1)} (${day.count} ratings)`}
                />
                <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                  {day.date.split('-')[2]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Template Performance Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Template Performance
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ratings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Top Issue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Recommendations
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {templateReports.map((report) => {
                  const topIssue = Object.entries(report.metrics.issueFrequency)
                    .sort((a, b) => b[1] - a[1])[0];

                  return (
                    <tr key={report.templateId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {report.templateName || 'Unnamed Template'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {report.sampleSize} samples
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {report.metrics.averageRating.toFixed(1)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {report.metrics.thumbsUpPercentage.toFixed(0)}% positive
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {report.metrics.totalRatings}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(report.metrics.recentTrend)}
                          <span className="text-sm capitalize text-gray-600 dark:text-gray-400">
                            {report.metrics.recentTrend}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {topIssue ? (
                          <div className="text-sm">
                            <div className="text-gray-900 dark:text-white">
                              {topIssue[0].replace(/-/g, ' ')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {topIssue[1]} occurrences
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No issues</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {report.recommendations.length > 0 ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {report.recommendations[0]}
                          </div>
                        ) : (
                          <span className="text-sm text-green-600 dark:text-green-400">
                            No recommendations
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Issues */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Most Common Issues
          </h2>
          <div className="space-y-3">
            {topIssues.map((issue, index) => (
              <div key={issue.issue} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {issue.issue.replace(/-/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {issue.count} ({issue.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(issue.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Comparison */}
        {modelComparison.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Model Performance Comparison
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modelComparison.map((model) => (
                <div
                  key={model.model_name}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-3">
                    {model.model_name}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Quality:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {model.avg_quality?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Success:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {model.avg_success_rate?.toFixed(1) || 'N/A'}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Avg Time:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {model.avg_processing_time?.toFixed(0) || 'N/A'}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Cost:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${model.total_cost?.toFixed(4) || '0.0000'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateAnalytics;
