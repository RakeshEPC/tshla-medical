import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Phone,
  Users,
  MessageSquare,
  Calendar,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  FileText,
  Download,
  Eye,
  EyeOff,
  Settings,
  ExternalLink,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CallSummaryPanel } from '../components/CallSummaryPanel';
import { LiveTranscriptViewer } from '../components/LiveTranscriptViewer';
import type { CallSummary, LiveTranscriptEntry } from '../types/callSummary';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface CallData {
  id: string;
  callSid: string;
  phoneNumber: string;
  patientName?: string;
  startTime: string;
  endTime?: string;
  status: string;
  duration?: number;
  summary?: string;
  patientDob?: string;
  reason?: string;
  urgency?: string;
  aiInteractions?: any[];
  hasTranscription?: boolean;
}

// Using LiveTranscriptEntry from types

interface LiveCall {
  callSid: string;
  phoneNumber: string;
  startTime: Date;
  status: 'active' | 'completed';
  hasTranscription: boolean;
}

interface DashboardStats {
  totalCalls: number;
  activeCalls: number;
  todaysCalls: number;
  averageDuration: number;
  urgentCalls: number;
  liveTranscriptions?: number;
}

const PhoneSystemDashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    activeCalls: 0,
    todaysCalls: 0,
    averageDuration: 0,
    urgentCalls: 0,
    liveTranscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  // Live transcription state
  const [activeCall, setActiveCall] = useState<LiveCall | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<Record<string, LiveTranscriptEntry[]>>({});
  const [activeSummary, setActiveSummary] = useState<CallSummary | null>(null);
  const [transcriptionExpanded, setTranscriptionExpanded] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    // Force connection to unified server on port 9011
    logDebug('PhoneSystemDashboard', 'Debug message', {});
    const newSocket = io('http://localhost:9011', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true, // Force new connection
      timestamp: Date.now(), // Break cache
    });

    newSocket.on('connect', () => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
    });

    newSocket.on('disconnect', reason => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
    });

    newSocket.on('connect_error', error => {
      logError('PhoneSystemDashboard', 'Error message', {});
    });

    newSocket.on('call-started', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      setActiveCall({
        callSid: data.callSid,
        phoneNumber: data.phoneNumber,
        startTime: new Date(data.timestamp),
        status: 'active',
        hasTranscription: false,
      });
      setLiveTranscripts(prev => ({ ...prev, [data.callSid]: [] }));
    });

    newSocket.on('transcription-started', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      setActiveCall(prev => {
        if (prev && prev.callSid === data.callSid) {
          return { ...prev, hasTranscription: true };
        }
        return prev;
      });
    });

    newSocket.on('live-transcript', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});

      setLiveTranscripts(prev => {
        logDebug('PhoneSystemDashboard', 'Debug message', {});
        const updated = {
          ...prev,
          [data.callSid]: [
            ...(prev[data.callSid] || []),
            {
              text: data.text,
              speaker: data.speaker,
              confidence: data.confidence,
              timestamp: new Date(data.timestamp),
              isPartial: data.isPartial,
              type: data.type,
            },
          ],
        };
        logInfo('PhoneSystemDashboard', 'Info message', {});
        return updated;
      });

      // Auto-scroll to bottom of transcript
      setTimeout(() => {
        const transcriptContainer = document.getElementById('transcript-container');
        if (transcriptContainer) {
          transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        }
      }, 100);
    });

    newSocket.on('call-completed', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      setActiveCall(null);
      fetchDashboardData(); // Refresh data
    });

    newSocket.on('transcription-stopped', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      if (data.finalTranscript) {
        logInfo('PhoneSystemDashboard', 'Info message', {});
      }
    });

    newSocket.on('call-summary-generated', data => {
      logInfo('PhoneSystemDashboard', 'Info message', {});
      // Refresh dashboard data to show updated summary
      fetchDashboardData();
    });

    newSocket.on('progressive-summary', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      // Update active summary with live data
      if (data.callSid && data.summary) {
        setActiveSummary(data.summary);
      }
    });

    newSocket.on('transcription-error', data => {
      logError('PhoneSystemDashboard', 'Error message', {});
    });

    newSocket.on('dashboard-state', data => {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      // Update stats with live data
      setStats(prev => ({
        ...prev,
        activeCalls: data.activeCalls?.length || 0,
        liveTranscriptions: data.activeTranscriptions?.length || 0,
      }));

      // Check if there are active calls and set the active call state
      if (data.activeCalls && data.activeCalls.length > 0) {
        const [callSid, callData] = data.activeCalls[0]; // Get first active call
        setActiveCall({
          callSid: callSid,
          phoneNumber: callData.phoneNumber,
          startTime: new Date(callData.startTime),
          status: 'active',
          hasTranscription: callData.hasTranscription || false,
        });

        // Initialize transcript for this call if not already present
        if (!liveTranscripts[callSid]) {
          setLiveTranscripts(prev => ({ ...prev, [callSid]: [] }));
        }
      } else {
        // No active calls, clear active call state
        setActiveCall(null);
      }
    });

    setSocket(newSocket);

    // Initial data fetch
    fetchDashboardData();

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      logDebug('PhoneSystemDashboard', 'Debug message', {});
      const response = await fetch('http://localhost:9011/api/dashboard/communications');

      if (response.ok) {
        const data = await response.json();
        logDebug('PhoneSystemDashboard', 'Debug message', {});

        if (data.communications && Array.isArray(data.communications)) {
          setRecentCalls(data.communications);
        }

        if (data.stats) {
          setStats({
            totalCalls: data.stats.totalCalls || 0,
            activeCalls: data.stats.activeCalls || 0,
            todaysCalls: data.stats.recentCalls || 0,
            averageDuration: data.stats.serverUptime || 0,
            urgentCalls: data.stats.urgentCalls || 0,
            liveTranscriptions: data.stats.liveTranscriptions || 0,
          });
        }
      }

      setLoading(false);
    } catch (error) {
      logError('PhoneSystemDashboard', 'Error message', {});
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in-progress':
      case 'active':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'no-answer':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Helper functions moved to components

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Phone className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Live Transcription Call Center</h1>
                <p className="text-gray-600">
                  Real-time conversation monitoring and patient interaction
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {activeCall && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-red-100 rounded-lg">
                  <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-red-700">LIVE CALL</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">Ready</span>
                <span className="text-xs text-gray-500">+18324027671</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Calls</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCalls}</p>
              </div>
              <Phone className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Calls</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeCalls}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Calls</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todaysCalls}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Urgent Calls</p>
                <p className="text-2xl font-bold text-red-600">{stats.urgentCalls}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Live Transcriptions</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {stats.liveTranscriptions || 0}
                </p>
              </div>
              <Mic className="w-8 h-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Server Uptime</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor(stats.averageDuration / 60)}m
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Enhanced Split-View Layout */}
        {activeCall ? (
          /* Live Call Mode - Split View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side - Live Transcript */}
            <LiveTranscriptViewer
              transcripts={liveTranscripts[activeCall.callSid] || []}
              isActive={true}
              isExpanded={transcriptionExpanded}
              onToggleExpanded={() => setTranscriptionExpanded(!transcriptionExpanded)}
              callSid={activeCall.callSid}
              className="h-full"
            />

            {/* Right Side - AI Summary */}
            <CallSummaryPanel summary={activeSummary} isLive={true} className="h-full" />
          </div>
        ) : (
          /* No Active Call - Dashboard View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Calls */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Calls</h3>
                <p className="text-sm text-gray-600">
                  Latest patient interactions and call summaries
                </p>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading calls...</span>
                  </div>
                ) : recentCalls.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent calls</p>
                    <p className="text-sm">Calls will appear here once patients start calling</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {recentCalls.map(call => (
                      <div
                        key={call.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {call.patientName || 'Unknown Patient'}
                                </h4>
                                <p className="text-sm text-gray-600">{call.phoneNumber}</p>
                              </div>
                              <div className="flex space-x-2">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}
                                >
                                  {call.status}
                                </span>
                                {call.hasTranscription && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium text-indigo-600 bg-indigo-100">
                                    📝 Transcribed
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">
                                {call.summary || call.reason || 'No summary available'}
                              </p>
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatTime(call.startTime)}
                                </span>
                                {call.duration && (
                                  <span className="flex items-center">
                                    <Activity className="w-3 h-3 mr-1" />
                                    {formatDuration(call.duration)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats & Controls */}
            <div className="space-y-6">
              <CallSummaryPanel summary={undefined} isLive={false} className="h-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneSystemDashboard;
