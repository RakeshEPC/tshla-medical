/**
 * PCM Call Summaries - Provider Review Dashboard
 * Review weekly AI call summaries and respond to patients
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Mic,
  Send,
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Calendar
} from 'lucide-react';
import { pcmAICallService, type CallSummary } from '../services/pcmAICall.service';
import { pcmService } from '../services/pcm.service';

export default function PCMCallSummaries() {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [filteredSummaries, setFilteredSummaries] = useState<CallSummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<CallSummary | null>(null);
  const [filterReviewed, setFilterReviewed] = useState<string>('unreviewed');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Response modal state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseType, setResponseType] = useState<'encouraging' | 'instructional' | 'urgent_callback' | 'emergency'>('encouraging');
  const [responseText, setResponseText] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  useEffect(() => {
    filterSummaries();
  }, [summaries, filterReviewed, filterUrgency, searchQuery]);

  const loadSummaries = async () => {
    setIsLoading(true);
    try {
      const data = await pcmAICallService.getCallSummaries();
      setSummaries(data);
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSummaries = () => {
    let filtered = [...summaries];

    if (filterReviewed === 'reviewed') {
      filtered = filtered.filter(s => s.reviewed);
    } else if (filterReviewed === 'unreviewed') {
      filtered = filtered.filter(s => !s.reviewed);
    }

    if (filterUrgency !== 'all') {
      filtered = filtered.filter(s => s.urgencyLevel === filterUrgency);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(s =>
        s.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.summaryText.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredSummaries(filtered);
  };

  const handleOpenResponse = async (summary: CallSummary) => {
    setSelectedSummary(summary);
    setShowResponseModal(true);

    // Fetch patient phone number
    const phone = await pcmService.getPatientPhone(summary.patientId);
    setPatientPhone(phone || '');

    // Pre-populate response based on urgency
    if (summary.urgencyLevel === 'urgent' || summary.urgencyLevel === 'emergency') {
      setResponseType('urgent_callback');
      setResponseText(pcmAICallService.getResponseTemplate('urgent_callback', {
        concern: summary.flags.join(', ') || 'your recent update'
      }));
    } else if (summary.flags.length > 0) {
      setResponseType('instructional');
      setResponseText(pcmAICallService.getResponseTemplate('instructional', {
        issue: summary.flags[0],
        instruction: 'Please continue monitoring and call if symptoms worsen'
      }));
    } else {
      setResponseType('encouraging');
      setResponseText(pcmAICallService.getResponseTemplate('encouraging'));
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedSummary || !responseText.trim()) return;

    setIsSubmittingResponse(true);
    try {
      await pcmAICallService.recordProviderResponse({
        summaryId: selectedSummary.id,
        patientId: selectedSummary.patientId,
        patientPhone: patientPhone || undefined,
        providerId: 'current-provider-id', // From auth context
        providerName: 'Dr. Johnson',
        responseType,
        responseText,
        deliveryMethod: 'phone_call' // Will make actual phone call
      });

      await loadSummaries();
      setShowResponseModal(false);
      setSelectedSummary(null);
      setResponseText('');
      setPatientPhone('');
      alert(`Voice response sent successfully to ${patientPhone}!`);
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Failed to send response');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'emergency':
        return 'border-red-500 bg-red-50';
      case 'urgent':
        return 'border-orange-500 bg-orange-50';
      case 'moderate':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-green-500 bg-green-50';
    }
  };

  const getUrgencyBadge = (level: string) => {
    const colors = {
      emergency: 'bg-red-600 text-white',
      urgent: 'bg-orange-600 text-white',
      moderate: 'bg-yellow-600 text-white',
      routine: 'bg-green-600 text-white'
    };
    return colors[level as keyof typeof colors] || colors.routine;
  };

  const getMetricIcon = (value: string, type: string) => {
    if (type === 'adherence') {
      return value === 'yes' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    if (type === 'control') {
      return value === 'good' ? <TrendingDown className="w-5 h-5 text-green-600" /> : <TrendingUp className="w-5 h-5 text-red-600" />;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading call summaries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/pcm/provider')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Weekly Call Summaries</h1>
                <p className="text-sm text-gray-600">Review AI-generated patient check-ins</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={filterReviewed}
                onChange={(e) => setFilterReviewed(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Summaries</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>
            <div>
              <select
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Urgency Levels</option>
                <option value="emergency">Emergency</option>
                <option value="urgent">Urgent</option>
                <option value="moderate">Moderate</option>
                <option value="routine">Routine</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Unreviewed</div>
                <div className="text-2xl font-bold text-blue-600">{summaries.filter(s => !s.reviewed).length}</div>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Urgent</div>
                <div className="text-2xl font-bold text-red-600">{summaries.filter(s => s.urgencyLevel === 'urgent' || s.urgencyLevel === 'emergency').length}</div>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Reviewed</div>
                <div className="text-2xl font-bold text-green-600">{summaries.filter(s => s.reviewed).length}</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Calls</div>
                <div className="text-2xl font-bold text-purple-600">{summaries.length}</div>
              </div>
              <Phone className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Summaries List */}
        <div className="space-y-4">
          {filteredSummaries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No call summaries found</h3>
              <p className="text-gray-600">
                {searchQuery || filterReviewed !== 'all' || filterUrgency !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Call summaries will appear here after weekly check-ins'}
              </p>
            </div>
          ) : (
            filteredSummaries.map((summary) => (
              <div
                key={summary.id}
                className={`bg-white rounded-xl shadow-sm border-l-4 p-6 ${getUrgencyColor(summary.urgencyLevel)}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{summary.patientName}</h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getUrgencyBadge(summary.urgencyLevel)}`}>
                        {summary.urgencyLevel.toUpperCase()}
                      </span>
                      {summary.reviewed && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Reviewed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(summary.callDate).toLocaleDateString()} at {new Date(summary.callDate).toLocaleTimeString()}
                    </div>
                  </div>
                  {!summary.reviewed && (
                    <button
                      onClick={() => handleOpenResponse(summary)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Respond
                    </button>
                  )}
                </div>

                {/* Summary Text */}
                <div className="bg-white rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-700">{summary.summaryText}</div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Medication Adherence</div>
                    <div className="flex items-center gap-2">
                      {getMetricIcon(summary.extractedMetrics.medicationAdherence, 'adherence')}
                      <span className="text-sm font-semibold capitalize">{summary.extractedMetrics.medicationAdherence}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Blood Sugar Control</div>
                    <div className="flex items-center gap-2">
                      {getMetricIcon(summary.extractedMetrics.bloodSugarControl, 'control')}
                      <span className="text-sm font-semibold capitalize">{summary.extractedMetrics.bloodSugarControl}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Emotional State</div>
                    <div className="flex items-center gap-2">
                      <Heart className={`w-5 h-5 ${
                        summary.extractedMetrics.emotionalState === 'positive' ? 'text-green-600' :
                        summary.extractedMetrics.emotionalState === 'concerned' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                      <span className="text-sm font-semibold capitalize">{summary.extractedMetrics.emotionalState}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Confidence Level</div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-semibold">{summary.extractedMetrics.confidenceLevel}/10</span>
                    </div>
                  </div>
                </div>

                {/* Flags & Action Items */}
                {(summary.flags.length > 0 || summary.actionItems.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summary.flags.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-2">Flags:</div>
                        <div className="flex flex-wrap gap-2">
                          {summary.flags.map((flag, idx) => (
                            <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200">
                              {flag.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {summary.actionItems.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-2">Recommended Actions:</div>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {summary.actionItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-purple-600">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Response Modal */}
      {showResponseModal && selectedSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900">Call {selectedSummary.patientName}</h3>
              <p className="text-sm text-gray-600 mt-1">Your message will be converted to speech and delivered via automated phone call</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Phone Number */}
              {patientPhone && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-sm font-semibold text-blue-900">Call will be placed to:</div>
                    <div className="text-lg font-bold text-blue-700">{patientPhone}</div>
                  </div>
                </div>
              )}

              {/* Response Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Response Type</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['encouraging', 'instructional', 'urgent_callback', 'emergency'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setResponseType(type);
                        setResponseText(pcmAICallService.getResponseTemplate(type));
                      }}
                      className={`p-3 rounded-lg border-2 transition ${
                        responseType === type
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-sm font-semibold capitalize">{type.replace('_', ' ')}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Response Text */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Write your message to the patient..."
                />
                <div className="text-xs text-gray-500 mt-1">
                  This will be converted to speech using ElevenLabs AI and delivered via phone call
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedSummary(null);
                    setResponseText('');
                    setPatientPhone('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResponse}
                  disabled={isSubmittingResponse || !responseText.trim() || !patientPhone}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingResponse ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Calling patient...
                    </>
                  ) : (
                    <>
                      <Phone className="w-5 h-5" />
                      Call Patient & Deliver Response
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
