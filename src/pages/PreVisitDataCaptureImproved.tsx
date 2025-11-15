/**
 * Improved Pre-Visit Data Capture Page
 * Better organization with filters, search, patient linking, and export
 */

import { useState, useEffect } from 'react';
import {
  Phone, Clock, Pill, AlertCircle, HelpCircle, Calendar, RefreshCw,
  Search, Filter, Download, User, ChevronDown, ChevronUp,
  CheckCircle, XCircle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
  patient_profile_id: string | null;
  appointment_id: string | null;
  structured_data: any;
  created_at: string;
  updated_at: string;
}

interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  hasPhone: boolean | null;
  hasLinkedProfile: boolean | null;
  isCompleted: boolean | null;
}

export default function PreVisitDataCaptureImproved() {
  const [sessions, setSessions] = useState<PreVisitSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<PreVisitSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateFrom: '',
    dateTo: '',
    hasPhone: null,
    hasLinkedProfile: null,
    isCompleted: null
  });

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/previsit/sessions/all`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const sessionsData = data.sessions || [];
      setSessions(sessionsData);
      setFilteredSessions(sessionsData);
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

  // Apply filters
  useEffect(() => {
    let filtered = [...sessions];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(session =>
        session.phone_number?.toLowerCase().includes(searchLower) ||
        session.conversation_id?.toLowerCase().includes(searchLower) ||
        session.medications?.some(m => m.toLowerCase().includes(searchLower)) ||
        session.concerns?.some(c => c.toLowerCase().includes(searchLower))
      );
    }

    // Date filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(s => new Date(s.created_at) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59);
      filtered = filtered.filter(s => new Date(s.created_at) <= toDate);
    }

    // Has phone filter
    if (filters.hasPhone !== null) {
      filtered = filtered.filter(s =>
        filters.hasPhone ? !!s.phone_number : !s.phone_number
      );
    }

    // Has linked profile filter
    if (filters.hasLinkedProfile !== null) {
      filtered = filtered.filter(s =>
        filters.hasLinkedProfile ? !!s.patient_profile_id : !s.patient_profile_id
      );
    }

    // Is completed filter
    if (filters.isCompleted !== null) {
      filtered = filtered.filter(s =>
        filters.isCompleted ? !!s.completed_at : !s.completed_at
      );
    }

    setFilteredSessions(filtered);
  }, [filters, sessions]);

  const clearFilters = () => {
    setFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      hasPhone: null,
      hasLinkedProfile: null,
      isCompleted: null
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Phone', 'Duration', 'Medications', 'Concerns', 'Questions', 'Completed', 'Linked'];
    const rows = filteredSessions.map(s => [
      new Date(s.created_at).toLocaleString(),
      s.phone_number || 'N/A',
      formatDuration(s.started_at, s.completed_at),
      s.medications?.length || 0,
      s.concerns?.length || 0,
      s.questions?.length || 0,
      s.completed_at ? 'Yes' : 'No',
      s.patient_profile_id ? 'Yes' : 'No'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `previsit-calls-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

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
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                disabled={filteredSessions.length === 0}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={fetchSessions}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredSessions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Pill className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Medications</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredSessions.reduce((sum, s) => sum + (s.medications?.length || 0), 0)}
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
                  <p className="text-sm text-gray-600">Concerns</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredSessions.reduce((sum, s) => sum + (s.concerns?.length || 0), 0)}
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
                  <p className="text-sm text-gray-600">Questions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredSessions.reduce((sum, s) => sum + (s.questions?.length || 0), 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Linked</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredSessions.filter(s => s.patient_profile_id).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by phone, conversation ID, medications, concerns..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showFilters && (
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.hasPhone === true}
                      onChange={(e) => setFilters({ ...filters, hasPhone: e.target.checked ? true : null })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Has Phone Number</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.hasLinkedProfile === true}
                      onChange={(e) => setFilters({ ...filters, hasLinkedProfile: e.target.checked ? true : null })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Linked to Profile</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.isCompleted === true}
                      onChange={(e) => setFilters({ ...filters, isCompleted: e.target.checked ? true : null })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Completed Calls</span>
                  </label>

                  <button
                    onClick={clearFilters}
                    className="ml-auto text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {sessions.length === 0 ? 'No Calls Yet' : 'No Results Found'}
            </h3>
            <p className="text-gray-600">
              {sessions.length === 0
                ? <>Call <span className="font-mono font-semibold">+1 (832) 402-7671</span> to start capturing data</>
                : 'Try adjusting your filters'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Session Header */}
                <div
                  className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition"
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                >
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">
                            {session.phone_number || 'Unknown Number'}
                          </h3>
                          {session.patient_profile_id && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-500/30 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Linked
                            </span>
                          )}
                          {session.completed_at ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/30 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/30 rounded-full text-xs font-medium">
                              <Clock className="w-3 h-3" />
                              In Progress
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-blue-100 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(session.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(session.started_at, session.completed_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{session.medications?.length || 0}</div>
                        <div className="text-xs text-blue-200">Medications</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{session.concerns?.length || 0}</div>
                        <div className="text-xs text-blue-200">Concerns</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{session.questions?.length || 0}</div>
                        <div className="text-xs text-blue-200">Questions</div>
                      </div>
                      {expandedSession === session.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedSession === session.id && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Medications */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Pill className="w-5 h-5 text-green-600" />
                          <h4 className="font-semibold text-gray-900">Medications</h4>
                          <span className="ml-auto bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                            {session.medications?.length || 0}
                          </span>
                        </div>
                        {session.medications && session.medications.length > 0 ? (
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
                            {session.concerns?.length || 0}
                          </span>
                        </div>
                        {session.concerns && session.concerns.length > 0 ? (
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
                            {session.questions?.length || 0}
                          </span>
                        </div>
                        {session.questions && session.questions.length > 0 ? (
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

                    {/* Metadata */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Conversation ID:</span>
                          <p className="font-mono text-xs mt-1 text-gray-900">{session.conversation_id}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Created:</span>
                          <p className="text-gray-900 mt-1">{formatDate(session.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Patient Profile:</span>
                          <p className="text-gray-900 mt-1">
                            {session.patient_profile_id ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                Linked
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-400">
                                <XCircle className="w-4 h-4" />
                                Not Linked
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Appointment:</span>
                          <p className="text-gray-900 mt-1">
                            {session.appointment_id ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                Linked
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-400">
                                <XCircle className="w-4 h-4" />
                                Not Linked
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
