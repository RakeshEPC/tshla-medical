/**
 * Unified Patient Portal Dashboard
 * Main entry point for patient portal with 3-section layout:
 * 1. Payment Management
 * 2. Audio Visit Summaries
 * 3. AI Diabetes Educator Chat
 *
 * Created: 2026-01-23
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CreditCard,
  Volume2,
  MessageSquare,
  LogOut,
  User,
  Clock,
  FileText,
  ChevronRight,
  AlertCircle,
  Activity
} from 'lucide-react';
import PatientPortalLogin from '../components/PatientPortalLogin';

interface SessionData {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
  sessionStart: string;
}

interface DashboardStats {
  pendingPayments: number;
  pendingPaymentAmount: number;
  nextPaymentDue: string | null;
  audioSummaries: number;
  latestAudioDate: string | null;
  aiQuestionsToday: number;
  aiQuestionsRemaining: number;
}

export default function PatientPortalUnified() {
  const navigate = useNavigate();
  const location = useLocation();

  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dashboard data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cgmConnected, setCgmConnected] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  /**
   * Validate a staff access token (one-time, from schedule TSH ID click)
   */
  const validateStaffToken = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/patient-portal/validate-staff-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        const sessionData: SessionData = {
          patientPhone: data.patientPhone,
          tshlaId: data.tshlaId,
          patientName: data.patientName,
          sessionId: data.sessionId,
          sessionStart: new Date().toISOString(),
        };
        sessionStorage.setItem('patient_portal_session', JSON.stringify(sessionData));
        setSession(sessionData);
      }
    } catch {
      // Token invalid or expired — fall through to login screen
    }
    setIsLoading(false);
  };

  /**
   * Check for existing session on mount or from navigation state
   */
  useEffect(() => {
    // Check for staff access token in URL (from schedule TSH ID click)
    const params = new URLSearchParams(location.search);
    const staffToken = params.get('staffToken');
    if (staffToken) {
      // Remove token from URL for security (don't leave in browser history)
      window.history.replaceState({}, '', '/patient-portal-unified');
      validateStaffToken(staffToken);
      return;
    }

    // Check if session was passed via navigation state
    if (location.state?.session) {
      const incomingSession = location.state.session;
      setSession(incomingSession);
      // Also save to sessionStorage
      sessionStorage.setItem('patient_portal_session', JSON.stringify(incomingSession));
      setIsLoading(false);
    } else {
      // Otherwise check sessionStorage
      checkExistingSession();
    }
  }, [location.state]);

  /**
   * Load dashboard data after login
   */
  useEffect(() => {
    if (session) {
      // Immediately validate session hasn't expired
      const sessionAge = Date.now() - new Date(session.sessionStart).getTime();
      const twoHours = 2 * 60 * 60 * 1000;

      if (sessionAge >= twoHours) {
        // Session has expired
        sessionStorage.removeItem('patient_portal_session');
        setSession(null);
        return;
      }

      loadDashboardData();
      // Start session timeout timer (2 hours)
      startSessionTimer();
    }
  }, [session]);

  /**
   * Check if user already has active session
   */
  const checkExistingSession = () => {
    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);

        // Validate session has required fields
        if (!sessionData.sessionStart || !sessionData.sessionId || !sessionData.tshlaId) {
          sessionStorage.removeItem('patient_portal_session');
          setIsLoading(false);
          return;
        }

        // Check if session is still valid (within 2 hours)
        const sessionStartTime = new Date(sessionData.sessionStart).getTime();
        const currentTime = Date.now();
        const sessionAge = currentTime - sessionStartTime;
        const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

        if (sessionAge < twoHours && sessionAge > 0) {
          // Valid session
          setSession(sessionData);
        } else {
          // Session expired or invalid timestamp
          sessionStorage.removeItem('patient_portal_session');
        }
      } catch (error) {
        // Invalid session data
        sessionStorage.removeItem('patient_portal_session');
      }
    }
    setIsLoading(false);
  };

  /**
   * Handle successful login
   */
  const handleLoginSuccess = (sessionData: Omit<SessionData, 'sessionStart'>) => {
    const fullSessionData = {
      ...sessionData,
      sessionStart: new Date().toISOString()
    };

    // Save to sessionStorage
    sessionStorage.setItem('patient_portal_session', JSON.stringify(fullSessionData));

    // Track login in database
    trackPortalLogin(fullSessionData);

    setSession(fullSessionData);
  };

  /**
   * Track portal login for analytics
   */
  const trackPortalLogin = async (sessionData: SessionData) => {
    try {
      await fetch(`${API_BASE_URL}/api/patient-portal/track-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientPhone: sessionData.patientPhone,
          tshlaId: sessionData.tshlaId,
          sessionId: sessionData.sessionId,
          deviceType: getDeviceType(),
          userAgent: navigator.userAgent
        })
      });
    } catch (error) {
      console.error('Error tracking login:', error);
      // Non-critical, don't show error to user
    }
  };

  /**
   * Load dashboard statistics
   */
  const loadDashboardData = async () => {
    if (!session) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient-portal/dashboard?tshlaId=${session.tshlaId}`,
        {
          headers: {
            'X-Session-Id': session.sessionId
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      } else {
        setError('Failed to load dashboard data');
      }

      // Check CGM connection status
      try {
        const phone10 = session.patientPhone.replace(/\D/g, '').slice(-10);
        const cgmRes = await fetch(`${API_BASE_URL}/api/cgm/summary/${phone10}`);
        const cgmData = await cgmRes.json();
        if (cgmData.success && cgmData.summary?.configured) {
          setCgmConnected(true);
        }
      } catch {
        // Non-critical
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Network error loading dashboard');
    }
  };

  /**
   * Start session timeout timer
   * Checks every minute if session has expired
   */
  const startSessionTimer = () => {
    // Check session validity every minute
    const intervalId = setInterval(() => {
      const savedSession = sessionStorage.getItem('patient_portal_session');
      if (!savedSession) {
        clearInterval(intervalId);
        handleLogout();
        return;
      }

      try {
        const sessionData = JSON.parse(savedSession);
        const sessionAge = Date.now() - new Date(sessionData.sessionStart).getTime();
        const twoHours = 2 * 60 * 60 * 1000;

        if (sessionAge >= twoHours) {
          clearInterval(intervalId);
          handleLogout();
          alert('Your session has expired for security. Please log in again.');
        }
      } catch (error) {
        clearInterval(intervalId);
        handleLogout();
      }
    }, 60000); // Check every minute

    // Also set a timeout for exactly 2 hours from session start
    if (session?.sessionStart) {
      const sessionAge = Date.now() - new Date(session.sessionStart).getTime();
      const twoHours = 2 * 60 * 60 * 1000;
      const timeRemaining = twoHours - sessionAge;

      if (timeRemaining > 0) {
        setTimeout(() => {
          handleLogout();
          alert('Your session has expired for security. Please log in again.');
        }, timeRemaining);
      } else {
        // Session already expired
        handleLogout();
      }
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    sessionStorage.removeItem('patient_portal_session');
    setSession(null);
    setStats(null);
  };

  /**
   * Get device type for analytics
   */
  const getDeviceType = (): string => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  };

  /**
   * Navigate to section
   */
  const goToSection = (section: 'payment' | 'audio' | 'ai-chat' | 'hp-view' | 'cgm-connect') => {
    // Track section view
    trackSectionView(section);

    // Navigate to appropriate route
    const routes: { [key: string]: string } = {
      'payment': '/patient-portal/payment',
      'audio': '/patient-portal/audio',
      'ai-chat': '/patient-portal/ai-chat',
      'hp-view': '/patient-hp-view',
      'cgm-connect': cgmConnected ? '/patient-portal/cgm-data' : '/patient-portal/cgm-connect'
    };

    navigate(routes[section] || `/patient-portal/${section}`, {
      state: { session }
    });
  };

  /**
   * Track section view for analytics
   */
  const trackSectionView = async (section: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/patient-portal/track-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session?.sessionId,
          section
        })
      });
    } catch (error) {
      // Non-critical
    }
  };

  // Show login if no session (but check sessionStorage first to avoid flash)
  if (!session) {
    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession && !location.state?.session) {
      return <PatientPortalLogin onSuccess={handleLoginSuccess} />;
    }
    // Session exists in storage or navigation state, show loading while useEffect processes it
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">TSHLA Patient Portal</h1>
                <p className="text-xs text-gray-500">TSH {session.tshlaId}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h2 className="text-2xl font-bold">Welcome back, {session.patientName}!</h2>
          <div className="mt-2 flex items-center space-x-4 text-sm text-blue-100">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>Logged in {getTimeAgo(session.sessionStart)}</span>
            </div>
            <div className="hidden sm:block">•</div>
            <div className="hidden sm:block">Session expires in 2 hours</div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Box Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Main Grid (Mobile: Stack, Tablet: 2 cols, Desktop: 4 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Box 1: Payment */}
          <button
            onClick={() => goToSection('payment')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-left relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
          >
            {/* Badge if payment due */}
            {stats.pendingPayments > 0 && (
              <div className="absolute top-4 right-4">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="w-7 h-7 text-green-600" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">Pay Your Bill</h3>

            {stats.pendingPayments > 0 ? (
              <div>
                <p className="text-3xl font-bold text-red-600 mb-1">
                  ${(stats.pendingPaymentAmount / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                  {stats.pendingPayments} payment{stats.pendingPayments > 1 ? 's' : ''} due
                </p>
                {stats.nextPaymentDue && (
                  <p className="text-xs text-gray-500 mt-1">
                    Next due: {formatDate(stats.nextPaymentDue)}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-lg text-green-600 font-semibold mb-1">No Balance Due ✓</p>
                <p className="text-sm text-gray-600">All payments up to date</p>
              </div>
            )}

            <div className="mt-4 flex items-center text-blue-600 group-hover:translate-x-1 transition-transform">
              <span className="text-sm font-medium">
                {stats.pendingPayments > 0 ? 'Pay Now' : 'View History'}
              </span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </button>

          {/* Box 2: Audio Summaries */}
          <button
            onClick={() => goToSection('audio')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-left relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Volume2 className="w-7 h-7 text-blue-600" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">Audio Summaries</h3>

            {stats.audioSummaries > 0 ? (
              <div>
                <p className="text-3xl font-bold text-blue-600 mb-1">{stats.audioSummaries}</p>
                <p className="text-sm text-gray-600">
                  Visit summar{stats.audioSummaries > 1 ? 'ies' : 'y'} available
                </p>
                {stats.latestAudioDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Latest: {formatDate(stats.latestAudioDate)}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-lg text-gray-600 font-semibold mb-1">No Summaries Yet</p>
                <p className="text-sm text-gray-600">Audio summaries will appear after your visits</p>
              </div>
            )}

            <div className="mt-4 flex items-center text-blue-600 group-hover:translate-x-1 transition-transform">
              <span className="text-sm font-medium">
                {stats.audioSummaries > 0 ? 'Listen Now' : 'Learn More'}
              </span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </button>

          {/* Box 3: AI Chat */}
          <button
            onClick={() => goToSection('ai-chat')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-left relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-purple-600" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">Ask AI Educator</h3>

            <div>
              <p className="text-lg text-gray-700 font-semibold mb-1">
                Get answers about your care
              </p>
              <p className="text-sm text-gray-600">
                Questions today: {stats.aiQuestionsToday} / 20
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.aiQuestionsRemaining} questions remaining
              </p>
            </div>

            <div className="mt-4 flex items-center text-purple-600 group-hover:translate-x-1 transition-transform">
              <span className="text-sm font-medium">Start Chat</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </button>

          {/* Box 4: Connect CGM */}
          <button
            onClick={() => goToSection('cgm-connect')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-left relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="w-7 h-7 text-cyan-600" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {cgmConnected ? 'Your CGM' : 'Connect Your CGM'}
            </h3>

            {cgmConnected ? (
              <div>
                <p className="text-lg text-green-600 font-semibold mb-1">Connected</p>
                <p className="text-sm text-gray-600">
                  Syncing glucose data with your care team
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Automatic updates every 15 minutes
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg text-gray-700 font-semibold mb-1">
                  Share glucose data
                </p>
                <p className="text-sm text-gray-600">
                  Dexcom, Libre, Eversense & more
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Automatic sync with your care team
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center text-cyan-600 group-hover:translate-x-1 transition-transform">
              <span className="text-sm font-medium">
                {cgmConnected ? 'View Your Data' : 'Set Up Now'}
              </span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </button>
        </div>

        {/* Additional Quick Links */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => goToSection('hp-view')}
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <FileText className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">View Medical Chart</p>
                <p className="text-xs text-gray-600">Complete health history, labs, medications</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </button>

            <button
              onClick={() => navigate('/patient-portal/upload', { state: { session } })}
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition"
            >
              <FileText className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Upload Records</p>
                <p className="text-xs text-gray-600">Add reports from other doctors</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Need Help?</p>
              <p className="text-sm text-blue-800">
                Contact our office at{' '}
                <a href="tel:+18325938100" className="font-semibold hover:underline">
                  (832) 593-8100
                </a>
                {' '}during business hours (Mon-Fri, 8am-5pm)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper: Format date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Helper: Get time ago
 */
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
}
