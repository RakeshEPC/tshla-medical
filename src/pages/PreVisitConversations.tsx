/**
 * Pre-Visit Conversations Page
 * Displays real ElevenLabs conversation transcripts from pre-visit calls
 * Created: January 2025
 */

import { useState, useEffect } from 'react';
import { Phone, Clock, CheckCircle, AlertCircle, Calendar, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io';

interface Conversation {
  conversation_id: string;
  agent_name: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: string;
  call_successful: string;
  transcript_summary: string | null;
  call_summary_title: string | null;
  direction: string | null;
}

interface ConversationDetail {
  conversation_id: string;
  status: string;
  transcript: Array<{
    role: string;
    message: string;
    time_in_call_secs: number;
  }>;
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
    phone_call?: {
      external_number: string;
      direction: string;
    };
    termination_reason?: string;
  };
  analysis: {
    call_successful: string;
    transcript_summary: string;
    call_summary_title: string;
  };
}

export default function PreVisitConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCallingSomeone, setIsCallingSomeone] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/previsit/conversations`);
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationDetail = async (conversationId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/previsit/conversations/${conversationId}`);
      const data = await response.json();
      setSelectedConversation(data);
      setExpandedId(conversationId);
    } catch (error) {
      console.error('Error loading conversation detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const makeCall = async () => {
    if (!phoneNumber || isCallingSomeone) return;

    setIsCallingSomeone(true);
    try {
      // Add timeout to fetch request (3 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch(`${API_BASE_URL}/api/previsit/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success || result.callSid || result.conversation_id) {
        alert(`✅ Call initiated successfully!\n\nThe ElevenLabs agent will call ${phoneNumber} shortly.\n\nCall ID: ${result.callSid || result.conversation_id || 'Processing...'}\n\nRefresh this page in a few moments to see the conversation.`);
        setPhoneNumber('');
        // Reload conversations after 5 seconds
        setTimeout(loadConversations, 5000);
      } else {
        alert(`Failed to initiate call: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error making call:', error);
      if (error.name === 'AbortError') {
        alert('⏱️ Call request timed out.\n\nThe call may still be processing. Please check back in a minute or try again.');
      } else {
        alert(`❌ Error initiating call: ${error.message}\n\nPlease try again or check the console for details.`);
      }
    } finally {
      setIsCallingSomeone(false);
    }
  };

  const formatDate = (unixSecs: number) => {
    return new Date(unixSecs * 1000).toLocaleString();
  };

  const formatDuration = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string, callSuccessful: string) => {
    if (status === 'done' && callSuccessful === 'success') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      );
    } else if (status === 'done') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="w-3 h-3" />
          Completed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Clock className="w-3 h-3" />
          {status}
        </span>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversations...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Pre-Visit Conversations</h1>
              <p className="text-gray-600 mt-1">View and manage pre-visit call transcripts</p>
            </div>
            <button
              onClick={loadConversations}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Make Outbound Call Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Make Outbound Pre-Visit Call
          </h2>
          <div className="flex gap-3">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCallingSomeone}
            />
            <button
              onClick={makeCall}
              disabled={!phoneNumber || isCallingSomeone}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCallingSomeone ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Call Now
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Enter phone number with country code (e.g., +18326073630)
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
                <p className="text-sm text-gray-600">Total Calls</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {conversations.filter(c => c.call_successful === 'success').length}
                </p>
                <p className="text-sm text-gray-600">Successful</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(conversations.reduce((sum, c) => sum + c.call_duration_secs, 0) / 60)}
                </p>
                <p className="text-sm text-gray-600">Total Minutes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {conversations.reduce((sum, c) => sum + c.message_count, 0)}
                </p>
                <p className="text-sm text-gray-600">Total Messages</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="space-y-4">
          {conversations.map((conversation) => (
            <div
              key={conversation.conversation_id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              {/* Conversation Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {conversation.call_summary_title || 'Pre-Visit Call'}
                      </h3>
                      {getStatusBadge(conversation.status, conversation.call_successful)}
                      {conversation.direction && (
                        <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          {conversation.direction}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(conversation.start_time_unix_secs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(conversation.call_duration_secs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {conversation.message_count} messages
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (expandedId === conversation.conversation_id) {
                        setExpandedId(null);
                        setSelectedConversation(null);
                      } else {
                        loadConversationDetail(conversation.conversation_id);
                      }
                    }}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                  >
                    {expandedId === conversation.conversation_id ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        View Transcript
                      </>
                    )}
                  </button>
                </div>

                {/* Summary */}
                {conversation.transcript_summary && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{conversation.transcript_summary}</p>
                  </div>
                )}
              </div>

              {/* Expanded Transcript */}
              {expandedId === conversation.conversation_id && (
                <div className="border-t border-gray-200">
                  {isLoadingDetail ? (
                    <div className="p-6 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading transcript...</p>
                    </div>
                  ) : selectedConversation ? (
                    <div className="p-6">
                      {/* Call Metadata */}
                      {selectedConversation.metadata.phone_call && (
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Phone Number:</span>
                              <span className="ml-2 text-gray-900">
                                {selectedConversation.metadata.phone_call.external_number}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Direction:</span>
                              <span className="ml-2 text-gray-900">
                                {selectedConversation.metadata.phone_call.direction}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Summary */}
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
                        <h4 className="font-semibold text-gray-900 mb-2">AI Summary</h4>
                        <p className="text-sm text-gray-700">
                          {selectedConversation.analysis.transcript_summary}
                        </p>
                      </div>

                      {/* Full Transcript */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 mb-4">Full Transcript</h4>
                        {selectedConversation.transcript.map((turn, index) => (
                          <div
                            key={index}
                            className={`flex gap-4 ${
                              turn.role === 'agent' ? 'justify-start' : 'justify-end'
                            }`}
                          >
                            <div
                              className={`max-w-2xl rounded-lg p-4 ${
                                turn.role === 'agent'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-green-100 text-green-900'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-xs uppercase">
                                  {turn.role === 'agent' ? 'AI Agent' : 'Patient'}
                                </span>
                                <span className="text-xs opacity-75">
                                  {formatDuration(turn.time_in_call_secs)}
                                </span>
                              </div>
                              <p className="text-sm">{turn.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Termination Reason */}
                      {selectedConversation.metadata.termination_reason && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Call ended:</span>{' '}
                            {selectedConversation.metadata.termination_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-600">
                      Failed to load conversation details
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Conversations Yet</h3>
              <p className="text-gray-600">
                Make your first pre-visit call using the form above!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
