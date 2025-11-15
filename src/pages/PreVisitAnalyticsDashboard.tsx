/**
 * Pre-Visit Analytics Dashboard
 * Comprehensive analytics for pre-visit call system
 * Tracks completion rates, costs, ROI, and performance metrics
 * Created: January 2025
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  BarChart3,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import { getPreVisitAnalytics } from '../services/previsit.service';

interface AnalyticsData {
  total: number;
  completed: number;
  completionRate: number;
  urgent: number;
  urgentRate: number;
  withMedications: number;
  withConcerns: number;
  withQuestions: number;
  urgencyBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface CostMetrics {
  totalCalls: number;
  avgCallDuration: number;
  twilioMinutes: number;
  twilioCost: number;
  elevenLabsMinutes: number;
  elevenLabsCost: number;
  openAICalls: number;
  openAICost: number;
  totalCost: number;
  timesSaved: number;
  timeSavedValue: number;
  netROI: number;
}

export default function PreVisitAnalyticsDashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);

    try {
      const endDate = new Date().toISOString();
      const startDate = getStartDate(dateRange).toISOString();

      const data = await getPreVisitAnalytics(startDate, endDate);

      if (data) {
        setAnalytics(data);
        calculateCostMetrics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStartDate = (range: string): Date => {
    const now = new Date();
    switch (range) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  };

  const calculateCostMetrics = (data: AnalyticsData) => {
    const totalCalls = data.completed;
    const avgCallDuration = 4; // Average 4 minutes per call

    // Calculate costs
    const twilioMinutes = totalCalls * avgCallDuration;
    const twilioRate = 0.013; // $0.013 per minute
    const twilioVoicemailRate = 0.003; // $0.003 per voicemail
    const voicemailCalls = Math.round(totalCalls * 0.3); // 30% voicemail
    const twilioVoicemailCost = voicemailCalls * twilioVoicemailRate;
    const twilioCallCost = (totalCalls - voicemailCalls) * avgCallDuration * twilioRate;
    const twilioTotalCost = twilioCallCost + twilioVoicemailCost;

    const elevenLabsMinutes = (totalCalls - voicemailCalls) * avgCallDuration;
    const elevenLabsRate = 0.24; // $0.24 per minute
    const elevenLabsCost = elevenLabsMinutes * elevenLabsRate;

    const openAICalls = totalCalls; // One GPT-4 call per completed interview
    const openAIRate = 0.03; // ~$0.03 per call (with caching)
    const openAICost = openAICalls * openAIRate;

    const totalCost = twilioTotalCost + elevenLabsCost + openAICost;

    // Calculate time saved and value
    const minutesSavedPerVisit = 4; // 4 minutes saved per visit
    const timesSaved = totalCalls * minutesSavedPerVisit; // Total minutes saved
    const providerRatePerMinute = 3.33; // $200/hour = $3.33/minute
    const timeSavedValue = timesSaved * providerRatePerMinute;

    // Net ROI
    const netROI = timeSavedValue - totalCost;

    setCostMetrics({
      totalCalls,
      avgCallDuration,
      twilioMinutes,
      twilioCost: twilioTotalCost,
      elevenLabsMinutes,
      elevenLabsCost,
      openAICalls,
      openAICost,
      totalCost,
      timesSaved,
      timeSavedValue,
      netROI,
    });
  };

  const exportReport = () => {
    if (!analytics || !costMetrics) return;

    const report = {
      dateRange,
      generatedAt: new Date().toISOString(),
      analytics,
      costMetrics,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `previsit-analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pre-Visit Analytics</h1>
              <p className="text-gray-600 mt-1">Performance metrics, costs, and ROI tracking</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>

              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ROI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Calls */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {analytics?.completed || 0}
            </h3>
            <p className="text-gray-600 text-sm mt-1">Completed Calls</p>
            <p className="text-xs text-gray-500 mt-2">
              {analytics?.completionRate.toFixed(1)}% completion rate
            </p>
          </div>

          {/* Total Cost */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-xs text-gray-500">Cost</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              ${costMetrics?.totalCost.toFixed(2) || '0.00'}
            </h3>
            <p className="text-gray-600 text-sm mt-1">Total Expenses</p>
            <p className="text-xs text-gray-500 mt-2">
              ${(costMetrics?.totalCost / (costMetrics?.totalCalls || 1)).toFixed(2)} per call
            </p>
          </div>

          {/* Time Saved Value */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              ${costMetrics?.timeSavedValue.toFixed(2) || '0.00'}
            </h3>
            <p className="text-gray-600 text-sm mt-1">Time Saved Value</p>
            <p className="text-xs text-gray-500 mt-2">
              {costMetrics?.timesSaved || 0} minutes saved
            </p>
          </div>

          {/* Net ROI */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <CheckCircle className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-bold">
              ${costMetrics?.netROI.toFixed(2) || '0.00'}
            </h3>
            <p className="text-green-50 text-sm mt-1">Net ROI</p>
            <p className="text-xs text-green-100 mt-2">
              {costMetrics && costMetrics.totalCost > 0
                ? `${((costMetrics.netROI / costMetrics.totalCost) * 100).toFixed(0)}% return`
                : '0% return'}
            </p>
          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Call Completion Metrics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Call Performance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Attempted</span>
                <span className="font-semibold text-gray-900">{analytics?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Successfully Completed</span>
                <span className="font-semibold text-green-600">{analytics?.completed || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completion Rate</span>
                <span className="font-semibold text-blue-600">
                  {analytics?.completionRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Urgent Callbacks</span>
                <span className="font-semibold text-red-600">{analytics?.urgent || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Call Duration</span>
                <span className="font-semibold text-gray-900">
                  {costMetrics?.avgCallDuration} min
                </span>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Cost Breakdown
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600">Twilio (Calls)</span>
                  <span className="font-semibold text-gray-900">
                    ${costMetrics?.twilioCost.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {costMetrics?.twilioMinutes} minutes
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600">11Labs AI</span>
                  <span className="font-semibold text-gray-900">
                    ${costMetrics?.elevenLabsCost.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {costMetrics?.elevenLabsMinutes} AI minutes
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600">OpenAI (Extraction)</span>
                  <span className="font-semibold text-gray-900">
                    ${costMetrics?.openAICost.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {costMetrics?.openAICalls} GPT-4 calls
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total Cost</span>
                  <span className="font-bold text-lg text-gray-900">
                    ${costMetrics?.totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Quality Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medications Captured</h3>
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {analytics?.withMedications || 0}
            </div>
            <p className="text-gray-600 text-sm">
              {analytics &&
                analytics.completed > 0 &&
                ((analytics.withMedications / analytics.completed) * 100).toFixed(1)}
              % of completed calls
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Concerns Identified</h3>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {analytics?.withConcerns || 0}
            </div>
            <p className="text-gray-600 text-sm">
              {analytics &&
                analytics.completed > 0 &&
                ((analytics.withConcerns / analytics.completed) * 100).toFixed(1)}
              % of completed calls
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Questions Collected</h3>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {analytics?.withQuestions || 0}
            </div>
            <p className="text-gray-600 text-sm">
              {analytics &&
                analytics.completed > 0 &&
                ((analytics.withQuestions / analytics.completed) * 100).toFixed(1)}
              % of completed calls
            </p>
          </div>
        </div>

        {/* Urgency Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Urgency Level Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {analytics?.urgencyBreakdown.low || 0}
              </div>
              <div className="text-sm text-gray-600">Low Priority</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {analytics?.urgencyBreakdown.medium || 0}
              </div>
              <div className="text-sm text-gray-600">Medium Priority</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {analytics?.urgencyBreakdown.high || 0}
              </div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {analytics?.urgencyBreakdown.critical || 0}
              </div>
              <div className="text-sm text-gray-600">Critical</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
