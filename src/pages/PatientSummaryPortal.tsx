/**
 * Patient Summary Portal
 * Public page where patients access their visit summary via shareable link
 * Requires TSHLA ID verification before showing summary + audio
 *
 * Created: 2026-01-13
 * URL: /patient-summary/:linkId
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Volume2,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  Lock,
  RefreshCw
} from 'lucide-react';

interface SummaryInfo {
  summaryId: string;
  patientName: string;
  providerName: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
}

interface SummaryContent {
  summaryId: string;
  patientName: string;
  summaryText: string;
  providerName: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  hasAudio: boolean;
}

export default function PatientSummaryPortal() {
  const { linkId } = useParams<{ linkId: string }>();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // State
  const [step, setStep] = useState<'loading' | 'tshla_entry' | 'summary_view' | 'error'>('loading');
  const [summaryInfo, setSummaryInfo] = useState<SummaryInfo | null>(null);
  const [summaryContent, setSummaryContent] = useState<SummaryContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TSHLA ID input
  const [tshlaId, setTshlaId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Audio player
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Load summary info on mount
   */
  useEffect(() => {
    loadSummaryInfo();
  }, [linkId]);

  /**
   * Load basic summary info (public endpoint)
   */
  const loadSummaryInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-summaries/${linkId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('This summary link is invalid or has been removed.');
        } else if (response.status === 410) {
          setError('This summary link has expired. Please contact your doctor\'s office for assistance.');
        } else {
          setError('Unable to load summary. Please try again later.');
        }
        setStep('error');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSummaryInfo(data.data);
        setStep('tshla_entry');
      } else {
        setError(data.error || 'Failed to load summary');
        setStep('error');
      }

    } catch (err: any) {
      console.error('Error loading summary info:', err);
      setError('Network error. Please check your internet connection.');
      setStep('error');
    }
  };

  /**
   * Verify TSHLA ID and load summary content
   */
  const verifyTshlaId = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tshlaId.trim()) {
      setVerificationError('Please enter your TSHLA ID');
      return;
    }

    // Format TSHLA ID (add spaces if needed)
    let formattedTshlaId = tshlaId.trim().toUpperCase();

    // Remove any existing spaces or dashes
    formattedTshlaId = formattedTshlaId.replace(/[\s-]/g, '');

    // Check if it matches pattern: TSH followed by 6 characters
    if (!formattedTshlaId.match(/^TSH[A-Z0-9]{6}$/)) {
      // Try to auto-format if they just entered the numbers
      if (formattedTshlaId.match(/^[A-Z0-9]{6}$/)) {
        formattedTshlaId = 'TSH' + formattedTshlaId;
      } else if (!formattedTshlaId.startsWith('TSH')) {
        setVerificationError('TSHLA ID should start with "TSH" followed by 6 characters (e.g., TSH ABC-123)');
        return;
      }
    }

    // Add formatting: TSH XXX-XXX
    if (formattedTshlaId.length === 9) {
      formattedTshlaId = `${formattedTshlaId.slice(0, 6)}-${formattedTshlaId.slice(6)}`;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-summaries/${linkId}/verify-tshla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tshlaId: formattedTshlaId })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 429) {
          setVerificationError('Too many failed attempts. Please try again in 1 hour or contact the office at (832) 593-8100.');
        } else if (response.status === 403) {
          setVerificationError('TSHLA ID does not match. Please check your ID and try again.');
        } else {
          setVerificationError(data.error || 'Verification failed. Please try again.');
        }
        return;
      }

      // Success!
      setSummaryContent(data.data);
      setStep('summary_view');

    } catch (err: any) {
      console.error('Error verifying TSHLA ID:', err);
      setVerificationError('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Load and play audio
   */
  const loadAudio = async () => {
    if (audioUrl) {
      // Audio already loaded, just play it
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
      return;
    }

    // Load audio for the first time
    setIsLoadingAudio(true);
    setAudioError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-summaries/${linkId}/audio`);

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403) {
          setAudioError('Session expired. Please refresh the page and enter your TSHLA ID again.');
        } else {
          setAudioError(data.error || 'Failed to load audio');
        }
        return;
      }

      const data = await response.json();

      if (data.success) {
        setAudioUrl(data.data.audioUrl);
        // Audio will auto-play once loaded
      } else {
        setAudioError(data.error || 'Failed to load audio');
      }

    } catch (err: any) {
      console.error('Error loading audio:', err);
      setAudioError('Failed to load audio. Please try again.');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  /**
   * Handle audio loaded and auto-play
   */
  const handleAudioLoaded = () => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  /**
   * Handle audio ended
   */
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  /**
   * Calculate days until expiration
   */
  const getDaysUntilExpiration = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // ==============================================
  // RENDER
  // ==============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Volume2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TSHLA Medical</h1>
          <p className="text-gray-600 mt-2">Patient Visit Summary</p>
        </div>

        {/* Loading State */}
        {step === 'loading' && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your summary...</p>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="bg-white rounded-2xl shadow-xl p-12">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Summary</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Need help?</strong><br />
                  Contact our office at <a href="tel:+18325938100" className="text-blue-600 hover:underline">(832) 593-8100</a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TSHLA ID Entry Step */}
        {step === 'tshla_entry' && summaryInfo && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Patient Info Preview */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h2>
              <p className="text-gray-600">
                To view your visit summary from {formatDate(summaryInfo.createdAt)}, please enter your TSHLA ID
              </p>
            </div>

            {/* TSHLA ID Form */}
            <form onSubmit={verifyTshlaId} className="space-y-6">
              <div>
                <label htmlFor="tshlaId" className="block text-sm font-medium text-gray-700 mb-2">
                  Your TSHLA ID
                </label>
                <input
                  type="text"
                  id="tshlaId"
                  value={tshlaId}
                  onChange={(e) => {
                    setTshlaId(e.target.value);
                    setVerificationError(null);
                  }}
                  placeholder="TSH ABC-123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isVerifying}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Format: TSH followed by 6 characters (example: TSH ABC-123)
                </p>
              </div>

              {verificationError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800">{verificationError}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !tshlaId.trim()}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Access Summary
                  </>
                )}
              </button>
            </form>

            {/* Help Text */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                <strong>Don't have your TSHLA ID?</strong><br />
                Contact our office at <a href="tel:+18325938100" className="text-blue-600 hover:underline">(832) 593-8100</a>
              </p>
            </div>
          </div>
        )}

        {/* Summary View Step */}
        {step === 'summary_view' && summaryContent && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Visit Summary</h2>
                    <p className="text-sm text-gray-600">{summaryContent.patientName}</p>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4" />
                  <span>Provider: {summaryContent.providerName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(summaryContent.createdAt)}</span>
                </div>
              </div>

              {/* Expiration Warning */}
              {getDaysUntilExpiration(summaryContent.expiresAt) <= 2 && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-800">
                    <Clock className="w-4 h-4" />
                    <span>
                      This summary expires in {getDaysUntilExpiration(summaryContent.expiresAt)} day{getDaysUntilExpiration(summaryContent.expiresAt) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Text Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Your Visit Summary</h3>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {summaryContent.summaryText}
                </p>
              </div>
            </div>

            {/* Audio Player */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Volume2 className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Listen to Summary</h3>
              </div>

              {!audioUrl && !audioError && (
                <button
                  onClick={loadAudio}
                  disabled={isLoadingAudio}
                  className="w-full py-4 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isLoadingAudio ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating audio...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Listen to Summary
                    </>
                  )}
                </button>
              )}

              {audioUrl && (
                <div className="space-y-4">
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onLoadedData={handleAudioLoaded}
                    onEnded={handleAudioEnded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full"
                    controls
                  />

                  <button
                    onClick={loadAudio}
                    className="w-full py-3 px-4 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 flex items-center justify-center gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-5 h-5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Play Again
                      </>
                    )}
                  </button>
                </div>
              )}

              {audioError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-800 mb-2">{audioError}</p>
                      <button
                        onClick={() => {
                          setAudioError(null);
                          loadAudio();
                        }}
                        className="text-sm text-red-700 underline hover:text-red-900"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Beta Notice */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>⚠️ Beta Feature:</strong> This is a beta project from your doctor's office.
                  If you notice any errors in this summary, please let us know by calling <a href="tel:+18325938100" className="underline">(832) 593-8100</a>.
                </p>
              </div>
            </div>

            {/* Access Info */}
            <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-600">
              <p>
                You have accessed this summary {summaryContent.accessCount} time{summaryContent.accessCount !== 1 ? 's' : ''}.
                You can return to this page anytime before it expires.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
