import React, { useState, useEffect } from 'react';
import { pumpContext7Service } from '../services/pumpDriveContext7.service';
import { PumpAnalytics } from '../types/context7.types';
import { exportFeedbackToCSV, downloadCSV } from '../utils/pumpAnalytics';

export function PumpAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<PumpAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<number>(30); // days
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = () => {
    setLoading(true);
    const data = pumpContext7Service.calculateAnalytics(timeRange);
    setAnalytics(data);
    setLoading(false);
  };

  const handleExportCSV = () => {
    const allFeedback = pumpContext7Service.getAllFeedback();
    const csv = exportFeedbackToCSV(allFeedback);
    downloadCSV(csv, `pump-feedback-${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 text-center text-gray-600">
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pump Recommendation Analytics</h2>
          <p className="text-sm text-gray-600">
            Last {timeRange} days • {analytics.totalFeedback} feedback responses
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={e => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Overall Accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-900">Overall Accuracy</span>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="text-4xl font-bold text-blue-900">{analytics.overallAccuracy}%</div>
          <div className="text-sm text-blue-700 mt-1">
            {analytics.totalFeedback > 0
              ? `${Math.round((analytics.overallAccuracy / 100) * analytics.totalFeedback)} correct recommendations`
              : 'No data yet'}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-900">Total Feedback</span>
            <span className="text-2xl">💬</span>
          </div>
          <div className="text-4xl font-bold text-green-900">{analytics.totalFeedback}</div>
          <div className="text-sm text-green-700 mt-1">
            {analytics.totalFeedback > 0 ? 'responses collected' : 'Start collecting feedback'}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-purple-900">Trend</span>
            <span className="text-2xl">📈</span>
          </div>
          <div className="text-4xl font-bold text-purple-900">
            {analytics.overallAccuracy >= 75 ? '↑' : analytics.overallAccuracy >= 60 ? '→' : '↓'}
          </div>
          <div className="text-sm text-purple-700 mt-1">
            {analytics.overallAccuracy >= 75
              ? 'Excellent performance'
              : analytics.overallAccuracy >= 60
                ? 'Good performance'
                : 'Needs improvement'}
          </div>
        </div>
      </div>

      {/* Accuracy by Pump */}
      <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Accuracy by Pump</h3>

        {Object.keys(analytics.feedbackByPump).length === 0 ? (
          <p className="text-gray-600 text-sm">No pump-specific data available yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(analytics.feedbackByPump)
              .sort(([, a], [, b]) => b.recommended - a.recommended)
              .map(([pump, data]) => (
                <div key={pump} className="flex items-center gap-4">
                  <div className="w-40 font-medium text-gray-900 text-sm">{pump}</div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            data.accuracy >= 75
                              ? 'bg-green-500'
                              : data.accuracy >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${data.accuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-12">{data.accuracy}%</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {data.recommended} recommended • {data.chosen} chosen
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Top Reasons for Different Choices */}
      <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Why Users Choose Differently</h3>

        {analytics.topReasons.length === 0 ? (
          <p className="text-gray-600 text-sm">No reasons collected yet</p>
        ) : (
          <div className="space-y-2">
            {analytics.topReasons.map((item, index) => (
              <div key={item.reason} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 capitalize">
                      {item.reason.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Insights & Recommendations</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {analytics.overallAccuracy < 60 && (
                <li>
                  • <strong>Low accuracy detected:</strong> Review AI prompts and weighting factors
                </li>
              )}
              {analytics.topReasons.length > 0 && analytics.topReasons[0].percentage > 40 && (
                <li>
                  • <strong>Top reason for different choice:</strong> {analytics.topReasons[0].reason.replace(/_/g, ' ')} ({analytics.topReasons[0].percentage}%)
                </li>
              )}
              {analytics.totalFeedback < 10 && (
                <li>• <strong>Low feedback volume:</strong> Encourage more users to provide feedback</li>
              )}
              {analytics.overallAccuracy >= 75 && (
                <li>
                  • <strong>Great performance!</strong> Your recommendations are highly accurate
                </li>
              )}
              {Object.entries(analytics.feedbackByPump).some(([, data]) => data.accuracy < 50) && (
                <li>
                  • <strong>Some pumps have low accuracy:</strong> Consider adjusting weighting for specific pumps
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
