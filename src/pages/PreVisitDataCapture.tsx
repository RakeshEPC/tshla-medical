/**
 * Pre-Visit Data Capture Page
 * Displays structured data captured from ElevenLabs pre-visit calls
 * Shows medications, concerns, and questions extracted in real-time
 */

import { useState, useEffect } from 'react';
import { Phone, Clock, Pill, AlertCircle, HelpCircle, Calendar, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io';

interface PreVisitSession {
  id: string;
  conversation_id: string;
  phone_number: string | null;
  started_at: string;
  completed_at: string | null;
  medications: string[];
  concerns: string[];
  questions: string[];
  urgency_flags: string[];
  created_at: string;
  updated_at: string;
}

export default function PreVisitDataCapture() {
  const [sessions, setSessions] = useState<PreVisitSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/previsit/sessions/all`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (startDate: string, endDate: string | null) => {
    if (!endDate) return 'In progress';
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const durationSecs = Math.floor((end - start) / 1000);
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading pre-visit data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error Loading Data</h3>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={fetchSessions}
                className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pre-Visit Call Data</h1>
              <p className="text-gray-600 mt-2">
                Structured data captured from patient phone conversations
              </p>
            </div>
            <button
              onClick={fetchSessions}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Pill className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Medications Captured</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions.reduce((sum, s) => sum + s.medications.length, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Concerns Captured</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions.reduce((sum, s) => sum + s.concerns.length, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <HelpCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Questions Captured</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions.reduce((sum, s) => sum + s.questions.length, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Calls Yet</h3>
            <p className="text-gray-600">
              Call <span className="font-mono font-semibold">+1 (832) 402-7671</span> to start capturing data
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Session Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {session.phone_number || 'Unknown Number'}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-blue-100 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(session.started_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(session.started_at, session.completed_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-blue-100">Conversation ID</div>
                      <div className="font-mono text-xs mt-1">{session.conversation_id}</div>
                    </div>
                  </div>
                </div>

                {/* Session Content */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Medications */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Pill className="w-5 h-5 text-green-600" />
                        <h4 className="font-semibold text-gray-900">Medications</h4>
                        <span className="ml-auto bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                          {session.medications.length}
                        </span>
                      </div>
                      {session.medications.length > 0 ? (
                        <ul className="space-y-2">
                          {session.medications.map((med, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-1">•</span>
                              <span className="text-gray-700">{med}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No medications captured</p>
                      )}
                    </div>

                    {/* Concerns */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        <h4 className="font-semibold text-gray-900">Concerns</h4>
                        <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">
                          {session.concerns.length}
                        </span>
                      </div>
                      {session.concerns.length > 0 ? (
                        <ul className="space-y-2">
                          {session.concerns.map((concern, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-orange-600 mt-1">•</span>
                              <span className="text-gray-700">{concern}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No concerns captured</p>
                      )}
                    </div>

                    {/* Questions */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <HelpCircle className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold text-gray-900">Questions</h4>
                        <span className="ml-auto bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                          {session.questions.length}
                        </span>
                      </div>
                      {session.questions.length > 0 ? (
                        <ul className="space-y-2">
                          {session.questions.map((question, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-purple-600 mt-1">•</span>
                              <span className="text-gray-700">{question}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No questions captured</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
