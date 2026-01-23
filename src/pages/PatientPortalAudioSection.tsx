/**
 * Patient Portal Audio Section
 * Integrated audio summaries view within unified patient portal
 * Shows all visit audio summaries for logged-in patient
 * Created: 2026-01-23
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Volume2,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Calendar,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
}

interface AudioSummary {
  id: string;
  patient_phone: string;
  provider_name: string;
  summary_text: string;
  audio_url: string | null;
  created_at: string;
  expires_at: string;
  access_count: number;
  visit_date?: string;
}

export default function PatientPortalAudioSection() {
  const navigate = useNavigate();
  const location = useLocation();

  // Session from navigation state
  const [session, setSession] = useState<PatientSession | null>(null);

  // Audio data
  const [audioSummaries, setAudioSummaries] = useState<AudioSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Expanded summaries
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  /**
   * Load session from storage or navigation state
   */
  useEffect(() => {
    // Try to get session from navigation state first
    const stateSession = location.state?.session;
    if (stateSession) {
      setSession(stateSession);
      return;
    }

    // Fall back to session storage
    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession) {
      navigate('/patient-portal-login');
      return;
    }

    const sessionData: PatientSession = JSON.parse(savedSession);
    setSession(sessionData);
  }, [navigate, location.state]);

  /**
   * Load audio summaries
   */
  useEffect(() => {
    if (!session) return;
    loadAudioSummaries();
  }, [session]);

  /**
   * Load all audio summaries for patient
   */
  const loadAudioSummaries = async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-summaries/patient/${session.patientPhone}`,
        {
          headers: {
            'x-session-id': session.sessionId,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load audio summaries');
      }

      // Sort by created date (newest first)
      const sortedSummaries = (data.summaries || []).sort((a: AudioSummary, b: AudioSummary) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setAudioSummaries(sortedSummaries);
    } catch (err: any) {
      console.error('Load audio summaries error:', err);
      setError(err.message || 'Unable to load audio summaries');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle audio playback
   */
  const toggleAudio = async (summaryId: string, audioUrl: string) => {
    const audio = audioRefs.current[summaryId];

    // If already playing, pause
    if (playingId === summaryId) {
      audio?.pause();
      setPlayingId(null);
      return;
    }

    // Pause any currently playing audio
    if (playingId && audioRefs.current[playingId]) {
      audioRefs.current[playingId].pause();
    }

    // Load and play new audio
    if (!audio) {
      setLoadingAudioId(summaryId);
      const newAudio = new Audio(audioUrl);
      audioRefs.current[summaryId] = newAudio;

      newAudio.addEventListener('loadeddata', () => {
        setLoadingAudioId(null);
        newAudio.play();
        setPlayingId(summaryId);
      });

      newAudio.addEventListener('ended', () => {
        setPlayingId(null);
      });

      newAudio.addEventListener('error', () => {
        setLoadingAudioId(null);
        alert('Error loading audio. Please try again.');
      });
    } else {
      audio.play();
      setPlayingId(summaryId);
    }
  };

  /**
   * Toggle summary expansion
   */
  const toggleExpanded = (summaryId: string) => {
    const newExpanded = new Set(expandedSummaries);
    if (newExpanded.has(summaryId)) {
      newExpanded.delete(summaryId);
    } else {
      newExpanded.add(summaryId);
    }
    setExpandedSummaries(newExpanded);
  };

  /**
   * Check if summary is expired
   */
  const isExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading audio summaries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Unable to Load Summaries
          </h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center space-x-3">
            <Volume2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audio Summaries</h1>
              <p className="text-sm text-gray-600">
                {session?.patientName} • TSH ID: {session?.tshlaId}
              </p>
            </div>
          </div>
        </div>

        {/* No Summaries */}
        {audioSummaries.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Volume2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Summaries Yet</h2>
            <p className="text-gray-600 mb-6">
              Your visit summaries will appear here after your appointments.
            </p>
            <button
              onClick={() => navigate('/patient-portal-unified', { state: { session } })}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Audio Summaries List */}
        {audioSummaries.length > 0 && (
          <div className="space-y-4">
            {audioSummaries.map((summary) => {
              const expired = isExpired(summary.expires_at);
              const isExpanded = expandedSummaries.has(summary.id);
              const isPlaying = playingId === summary.id;
              const isLoadingAudio = loadingAudioId === summary.id;

              return (
                <div
                  key={summary.id}
                  className={`bg-white rounded-2xl shadow-xl overflow-hidden ${
                    expired ? 'opacity-75' : ''
                  }`}
                >
                  {/* Summary Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <User className="w-5 h-5 text-gray-600" />
                          <p className="font-semibold text-gray-900">
                            {summary.provider_name}
                          </p>
                          {expired && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {summary.visit_date
                                ? new Date(summary.visit_date).toLocaleDateString()
                                : new Date(summary.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {!expired && (
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                Expires:{' '}
                                {new Date(summary.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Audio Player Button */}
                      {!expired && summary.audio_url && (
                        <button
                          onClick={() => toggleAudio(summary.id, summary.audio_url!)}
                          disabled={isLoadingAudio}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isLoadingAudio ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                          <span>{isPlaying ? 'Pause' : 'Play'} Audio</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Text (Expandable) */}
                  <div className="p-6">
                    <button
                      onClick={() => toggleExpanded(summary.id)}
                      className="w-full flex items-center justify-between text-left mb-4"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Visit Summary</h3>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {isExpanded ? (
                      <div className="prose prose-sm max-w-none">
                        <div
                          className="text-gray-700 whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: summary.summary_text }}
                        />
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {summary.summary_text.substring(0, 200)}...
                      </p>
                    )}

                    {expired && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-sm text-red-700">
                          This summary has expired. Please contact your doctor's office
                          if you need access to this information.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
