/**
 * PumpDrive Analytics Dashboard
 * Admin-only analytics and insights for pump assessments
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  pumpAnalyticsService,
  type AnalyticsData,
  type PumpDistribution,
  type AssessmentTrend,
  type RecentAssessment
} from '../../services/pumpAnalytics.service';
import { logError } from '../../services/logger.service';

export default function PumpDriveAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<number>(30); // days

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pumpAnalyticsService.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      logError('Failed to load analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Analytics</h2>
            <p className="text-gray-600 mb-6">{error || 'An unexpected error occurred'}</p>
            <button
              onClick={loadAnalytics}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { summary, pumpDistribution, assessmentTrends, flowTypeStats, userEngagement, topPumps, recentAssessments } = analytics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 PumpDrive Analytics</h1>
              <p className="text-sm text-gray-600 mt-1">
                Last updated: {new Date(summary.lastUpdated).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>
              <button
                onClick={loadAnalytics}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Total Assessments</h3>
              <span className="text-2xl">📝</span>
            </div>
            <p className="text-4xl font-bold">{summary.totalAssessments.toLocaleString()}</p>
            <p className="text-sm opacity-75 mt-2">All time</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Total Users</h3>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-4xl font-bold">{summary.totalUsers.toLocaleString()}</p>
            <p className="text-sm opacity-75 mt-2">Registered accounts</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Avg Match Score</h3>
              <span className="text-2xl">🎯</span>
            </div>
            <p className="text-4xl font-bold">{summary.avgMatchScore.toFixed(1)}%</p>
            <p className="text-sm opacity-75 mt-2">Across all assessments</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Completion Rate</h3>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-4xl font-bold">{summary.completionRate.toFixed(1)}%</p>
            <p className="text-sm opacity-75 mt-2">Users who finish</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pump Distribution */}
          <div className="lg:col-span-2 space-y-8">
            {/* Top Recommended Pumps */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">🏆 Top Recommended Pumps</h2>
              <div className="space-y-4">
                {topPumps.map((pump, index) => (
                  <div key={pump.pumpName} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-800">{pump.pumpName}</h3>
                        <span className="text-sm text-gray-600">{pump.count} assessments</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                            style={{ width: `${pump.percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-12">{pump.percentage.toFixed(1)}%</span>
                        <span className={`text-sm font-bold w-12 ${getScoreColor(pump.avgScore)}`}>
                          {pump.avgScore.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pump Distribution Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 All Pump Distribution</h2>
              <div className="space-y-3">
                {pumpDistribution.map((pump) => (
                  <div key={pump.pumpName} className="group hover:bg-gray-50 rounded-lg p-3 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{pump.pumpName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">{pump.count} times</span>
                        <span className="text-sm font-bold text-blue-600">{pump.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getScoreBgColor(pump.avgScore)}`}
                          style={{ width: `${pump.percentage}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs font-semibold ${getScoreColor(pump.avgScore)}`}>
                        Avg: {pump.avgScore.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flow Type Statistics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">🔀 Assessment Flow Types</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {flowTypeStats.map((flow) => (
                  <div key={flow.flowType} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-semibold text-gray-700 mb-2">{flow.flowType}</h3>
                    <p className="text-3xl font-bold text-gray-900 mb-1">{flow.count}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{flow.percentage.toFixed(1)}% of total</span>
                      <span className={`font-bold ${getScoreColor(flow.avgScore)}`}>
                        {flow.avgScore.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Activity & Engagement */}
          <div className="space-y-8">
            {/* User Engagement */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">👥 User Engagement</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">Total Users</span>
                  <span className="text-xl font-bold text-gray-900">{userEngagement.totalUsers}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">Completed</span>
                  <span className="text-xl font-bold text-green-600">{userEngagement.completedAssessments}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="text-xl font-bold text-blue-600">{userEngagement.conversionRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-600">Avg / User</span>
                  <span className="text-xl font-bold text-purple-600">{userEngagement.avgAssessmentsPerUser.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 Recent Assessments</h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {recentAssessments.map((assessment) => (
                  <div key={assessment.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{assessment.username}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(assessment.completedAt).toLocaleDateString()} at{' '}
                          {new Date(assessment.completedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        assessment.flowType === 'Pure AI' ? 'bg-purple-100 text-purple-700' :
                        assessment.flowType === 'Feature-based' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {assessment.flowType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{assessment.recommendedPump}</span>
                      </p>
                      <span className={`text-sm font-bold ${getScoreColor(assessment.matchScore)}`}>
                        {assessment.matchScore.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Assessment Trends (Timeline) */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📈 Assessment Trends (Last {timeRange} Days)</h2>
          <div className="h-64 flex items-end justify-between gap-2">
            {assessmentTrends.map((trend, index) => {
              const maxCount = Math.max(...assessmentTrends.map(t => t.count));
              const height = maxCount > 0 ? (trend.count / maxCount) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative group cursor-pointer flex-1 flex items-end w-full">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg hover:from-blue-600 hover:to-blue-400 transition-all"
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {trend.count} assessments
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 transform -rotate-45 origin-top-left whitespace-nowrap">
                    {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
