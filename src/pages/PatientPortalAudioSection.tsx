/**
 * Patient Portal Audio Section
 * Displays dictations with TTS audio and text summaries
 * Allows patients to play audio and delete recordings
 * Created: 2026-01-23
 * Updated: 2026-01-26 - Switched to dictations API
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
  FileText,
  Trash2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
}

interface Dictation {
  id: string;
  provider_name: string;
  patient_name: string;
  visit_date: string;
  summary_text: string;
  audio_url: string | null;
  audio_deleted: boolean;
  audio_deleted_at: string | null;
  created_at: string;
  has_audio: boolean;
}

export default function PatientPortalAudioSection() {
  const navigate = useNavigate();
  const location = useLocation();

  // Session from navigation state
  const [session, setSession] = useState<PatientSession | null>(null);

  // Dictation data
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Expanded summaries
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  // Delete confirmation modal
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
   * Load dictations
   */
  useEffect(() => {
    if (!session) return;
    loadDictations();
  }, [session]);

  /**
   * Load all dictations for patient
   */
  const loadDictations = async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/dictations/${session.tshlaId}`,
        {
          headers: {
            'x-session-id': session.sessionId,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load dictations');
      }

      setDictations(data.dictations || []);
    } catch (err: any) {
      console.error('Load dictations error:', err);
      setError(err.message || 'Unable to load dictations');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle audio playback
   * Generates audio on-demand via API if not yet created
   */
  const toggleAudio = async (dictationId: string, audioUrl: string | null) => {
    const audio = audioRefs.current[dictationId];

    // If already playing, pause
    if (playingId === dictationId) {
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
      setLoadingAudioId(dictationId);

      let resolvedUrl = audioUrl;

      // If no direct audio URL, generate on-demand via API
      if (!resolvedUrl) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/patient-summaries/portal-audio/${dictationId}`
          );
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to generate audio');
          }
          resolvedUrl = data.audioUrl;
        } catch (err: any) {
          setLoadingAudioId(null);
          alert(err.message || 'Error generating audio. Please try again.');
          return;
        }
      }

      const newAudio = new Audio(resolvedUrl!);
      audioRefs.current[dictationId] = newAudio;

      newAudio.addEventListener('loadeddata', () => {
        setLoadingAudioId(null);
        newAudio.play();
        setPlayingId(dictationId);
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
      setPlayingId(dictationId);
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
   * Delete audio file
   */
  const handleDeleteAudio = async (dictationId: string) => {
    if (!session) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/dictations/${dictationId}/audio`,
        {
          method: 'DELETE',
          headers: {
            'x-session-id': session.sessionId,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete audio');
      }

      // Update local state
      setDictations(prevDictations =>
        prevDictations.map(d =>
          d.id === dictationId
            ? { ...d, audio_url: null, audio_deleted: true, has_audio: false }
            : d
        )
      );

      // Stop playing if currently playing
      if (playingId === dictationId) {
        audioRefs.current[dictationId]?.pause();
        setPlayingId(null);
      }

      setShowDeleteModal(false);
      setDeletingId(null);
    } catch (err: any) {
      console.error('Delete audio error:', err);
      alert(err.message || 'Failed to delete audio. Please try again.');
    }
  };

  /**
   * Show delete confirmation
   */
  const confirmDelete = (dictationId: string) => {
    setDeletingId(dictationId);
    setShowDeleteModal(true);
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
              <h1 className="text-2xl font-bold text-gray-900">Visit Dictations</h1>
              <p className="text-sm text-gray-600">
                {session?.patientName} • TSH ID: {session?.tshlaId}
              </p>
            </div>
          </div>
        </div>

        {/* No Dictations */}
        {dictations.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Volume2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Dictations Yet</h2>
            <p className="text-gray-600 mb-6">
              Your visit dictations will appear here after your appointments.
            </p>
            <button
              onClick={() => navigate('/patient-portal-unified', { state: { session } })}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Dictations List */}
        {dictations.length > 0 && (
          <div className="space-y-4">
            {dictations.map((dictation) => {
              const isExpanded = expandedSummaries.has(dictation.id);
              const isPlaying = playingId === dictation.id;
              const isLoadingAudio = loadingAudioId === dictation.id;

              return (
                <div
                  key={dictation.id}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden"
                >
                  {/* Dictation Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <User className="w-5 h-5 text-gray-600" />
                          <p className="font-semibold text-gray-900">
                            {dictation.provider_name}
                          </p>
                          {dictation.audio_deleted && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                              Audio Deleted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {new Date(dictation.visit_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Audio Controls */}
                      <div className="flex items-center space-x-2">
                        {dictation.has_audio && (
                          <>
                            <button
                              onClick={() => toggleAudio(dictation.id, dictation.audio_url)}
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
                              <span>{isPlaying ? 'Pause' : 'Play'}</span>
                            </button>
                            <button
                              onClick={() => confirmDelete(dictation.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl"
                              title="Delete audio"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {!dictation.has_audio && !dictation.audio_deleted && (
                          <span className="text-sm text-gray-500 italic">No audio available</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dictation Text (Expandable) */}
                  <div className="p-6">
                    <button
                      onClick={() => toggleExpanded(dictation.id)}
                      className="w-full flex items-center justify-between text-left mb-4"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Visit Dictation</h3>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {isExpanded ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="text-gray-700 whitespace-pre-wrap">
                          {dictation.summary_text}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {dictation.summary_text.substring(0, 200)}...
                      </p>
                    )}

                    {dictation.audio_deleted && (
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-sm text-gray-700">
                          You deleted the audio recording for this visit. The text summary
                          remains available above.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
                <h2 className="text-xl font-bold text-gray-900">Delete Audio Recording?</h2>
              </div>
              <p className="text-gray-600 mb-6">
                This will permanently delete the audio recording for this visit. The
                text summary will remain available.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-xl hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deletingId && handleDeleteAudio(deletingId)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
                >
                  Delete Audio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
