/**
 * Staff AI Analytics Dashboard
 * View and analyze patient AI conversations
 * Quality assurance and insights into patient education needs
 * Created: 2026-01-23
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  TrendingUp,
  DollarSign,
  Users,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  Eye,
  Search
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Conversation {
  id: string;
  patient_phone: string;
  session_id: string;
  message_role: 'user' | 'assistant';
  message_text: string;
  audio_url?: string;
  topic_category: string;
  tokens_used: number;
  audio_characters: number;
  cost_cents: number;
  helpful_rating?: boolean;
  created_at: string;
}

interface Analytics {
  total_questions: number;
  total_tokens: number;
  total_cost_cents: number;
  avg_response_time_ms: number;
  satisfaction_rate: number;
  active_patients: number;
}

interface TopicBreakdown {
  topic: string;
  count: number;
  percentage: number;
}

interface UrgentAlert {
  id: string;
  patient_phone: string;
  alert_type: string;
  detected_symptoms: string[];
  patient_message: string;
  status: string;
  created_at: string;
}

export default function StaffAIAnalyticsDashboard() {
  // Date range
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Data
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [topicBreakdown, setTopicBreakdown] = useState<TopicBreakdown[]>([]);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [urgentAlerts, setUrgentAlerts] = useState<UrgentAlert[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  /**
   * Load analytics data
   */
  useEffect(() => {
    loadAnalytics();
  }, [startDate, endDate, selectedTopic]);

  /**
   * Fetch analytics from API
   */
  const loadAnalytics = async () => {
    setIsLoading(true);

    try {
      // Load overall analytics
      const analyticsRes = await fetch(
        `${API_BASE_URL}/api/ai-chat/analytics?startDate=${startDate}&endDate=${endDate}`
      );
      const analyticsData = await analyticsRes.json();

      if (analyticsData.success) {
        setAnalytics(analyticsData.analytics);
        setTopicBreakdown(analyticsData.topicBreakdown || []);
      }

      // Load recent conversations
      const conversationsRes = await fetch(
        `${API_BASE_URL}/api/ai-chat/conversations?limit=50&topic=${selectedTopic}`
      );
      const conversationsData = await conversationsRes.json();

      if (conversationsData.success) {
        setRecentConversations(conversationsData.conversations || []);
      }

      // Load urgent alerts
      const alertsRes = await fetch(`${API_BASE_URL}/api/ai-chat/urgent-alerts`);
      const alertsData = await alertsRes.json();

      if (alertsData.success) {
        setUrgentAlerts(alertsData.alerts || []);
      }
    } catch (error) {
      console.error('Load analytics error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * View patient conversation detail
   */
  const viewPatientConversation = (patientPhone: string) => {
    setSelectedPatient(patientPhone);
  };

  /**
   * Export data to CSV
   */
  const exportToCSV = () => {
    const csv = [
      ['Date', 'Patient', 'Topic', 'Question', 'Response', 'Tokens', 'Cost', 'Rating'].join(','),
      ...recentConversations
        .filter((c) => c.message_role === 'assistant')
        .map((c) => {
          const userMessage = recentConversations.find(
            (m) => m.session_id === c.session_id && m.message_role === 'user'
          );
          return [
            new Date(c.created_at).toLocaleDateString(),
            c.patient_phone,
            c.topic_category,
            `"${userMessage?.message_text || ''}"`,
            `"${c.message_text}"`,
            c.tokens_used,
            (c.cost_cents / 100).toFixed(2),
            c.helpful_rating === true ? 'Helpful' : c.helpful_rating === false ? 'Not Helpful' : 'N/A'
          ].join(',');
        })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-conversations-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  AI Educator Analytics
                </h1>
                <p className="text-sm text-gray-600">
                  Rachel's performance and patient insights
                </p>
              </div>
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-5 h-5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Topics</option>
                <option value="medications">Medications</option>
                <option value="diet">Diet</option>
                <option value="exercise">Exercise</option>
                <option value="monitoring">Monitoring</option>
                <option value="symptoms">Symptoms</option>
                <option value="lab_results">Lab Results</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
        </div>

        {/* Urgent Alerts Banner */}
        {urgentAlerts.filter((a) => a.status === 'pending').length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">
                  {urgentAlerts.filter((a) => a.status === 'pending').length} Urgent
                  Alert{urgentAlerts.filter((a) => a.status === 'pending').length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-red-700">
                  Patients reported urgent symptoms - immediate attention required
                </p>
              </div>
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                View Alerts
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Questions */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <span className="text-xs text-gray-500 uppercase">Questions</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {analytics.total_questions.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                From {analytics.active_patients} patient{analytics.active_patients !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Total Cost */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
                <span className="text-xs text-gray-500 uppercase">Total Cost</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ${(analytics.total_cost_cents / 100).toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {analytics.total_tokens.toLocaleString()} tokens used
              </p>
            </div>

            {/* Avg Response Time */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <span className="text-xs text-gray-500 uppercase">Avg Response</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {(analytics.avg_response_time_ms / 1000).toFixed(1)}s
              </p>
              <p className="text-sm text-gray-600 mt-1">Response time</p>
            </div>

            {/* Satisfaction Rate */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <ThumbsUp className="w-8 h-8 text-yellow-600" />
                <span className="text-xs text-gray-500 uppercase">Satisfaction</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {(analytics.satisfaction_rate * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600 mt-1">Helpful ratings</p>
            </div>
          </div>
        )}

        {/* Topic Breakdown */}
        {topicBreakdown.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Common Topics
            </h2>
            <div className="space-y-3">
              {topicBreakdown.slice(0, 7).map((topic) => (
                <div key={topic.topic}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {topic.topic.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-600">
                      {topic.count} ({topic.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${topic.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Conversations */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Conversations
            </h2>
            <div className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="px-3 py-2 border border-gray-300 rounded-lg w-64"
              />
            </div>
          </div>

          <div className="space-y-4">
            {recentConversations
              .filter((c) => c.message_role === 'assistant')
              .slice(0, 20)
              .map((conversation) => {
                const userMessage = recentConversations.find(
                  (m) =>
                    m.session_id === conversation.session_id &&
                    m.message_role === 'user' &&
                    new Date(m.created_at) < new Date(conversation.created_at)
                );

                return (
                  <div
                    key={conversation.id}
                    className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full capitalize">
                          {conversation.topic_category.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(conversation.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {conversation.helpful_rating === true && (
                          <ThumbsUp className="w-4 h-4 text-green-600" />
                        )}
                        {conversation.helpful_rating === false && (
                          <ThumbsDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className="text-xs text-gray-500">
                          ${(conversation.cost_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {userMessage && (
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          Patient Question:
                        </p>
                        <p className="text-sm text-gray-800 bg-blue-50 p-2 rounded">
                          {userMessage.message_text}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">
                        Rachel's Response:
                      </p>
                      <p className="text-sm text-gray-800 line-clamp-3">
                        {conversation.message_text}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{conversation.tokens_used} tokens</span>
                        {conversation.audio_url && (
                          <span className="flex items-center space-x-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Audio available</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => viewPatientConversation(conversation.patient_phone)}
                        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Patient History</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {recentConversations.filter((c) => c.message_role === 'assistant').length ===
            0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No conversations in selected date range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
