import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { auditLogService } from '../services/auditLog.service';
import { Clock, AlertTriangle } from 'lucide-react';

interface SessionMonitorProps {
  children: React.ReactNode;
}

const SESSION_TIMEOUT_MS =
  parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES || '30') * 60 * 1000;
const WARNING_BEFORE_TIMEOUT_MS =
  parseInt(import.meta.env.VITE_SESSION_WARNING_MINUTES || '2') * 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 1000; // Check every 10 seconds

export default function SessionMonitor({ children }: SessionMonitorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_TIMEOUT_MS);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const logoutTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle automatic logout
  const handleLogout = useCallback(
    async (reason: 'manual' | 'timeout' = 'timeout') => {
      const token = localStorage.getItem('auth_token');

      // Log the logout event
      await auditLogService.logLogout(reason);

      // Clear user context
      auditLogService.clearCurrentUser();

      if (token) {
        unifiedAuthService.logout();
      }
      localStorage.removeItem('auth_token');
      localStorage.removeItem('session_expires');
      navigate('/login', { replace: true });
    },
    [navigate]
  );

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    setShowWarning(false);
    setTimeRemaining(SESSION_TIMEOUT_MS);

    // Clear existing timeouts
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
    }

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS);

    // Set logout timeout
    logoutTimeoutRef.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT_MS);

    // Update session on server
    const token = localStorage.getItem('auth_token');
    if (token) {
      unifiedAuthService.isAuthenticated();
    }
  }, [handleLogout]);

  // Continue session
  const continueSession = useCallback(() => {
    resetActivityTimer();
    setShowWarning(false);
  }, [resetActivityTimer]);

  // Format time remaining
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Monitor user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = (event: Event) => {
      // Don't interfere with button clicks - let them handle themselves
      if (event.type === 'click') {
        return;
      }

      const now = Date.now();
      // Only reset if more than 30 seconds since last activity
      if (now - lastActivity > 30000) {
        resetActivityTimer();
      }
    };

    // Add passive event listeners that don't interfere with clicks
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle clicks separately with a non-interfering approach
    const handleClickActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 30000) {
        // Use setTimeout to avoid blocking the original click
        setTimeout(() => resetActivityTimer(), 0);
      }
    };

    // Use capture phase for click monitoring to avoid conflicts
    document.addEventListener('click', handleClickActivity, { capture: true, passive: true });

    // Initial setup
    resetActivityTimer();

    // Check session periodically
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivity;
      const remaining = SESSION_TIMEOUT_MS - elapsed;

      setTimeRemaining(Math.max(0, remaining));

      // Check if session expired on server
      const token = localStorage.getItem('auth_token');
      const expires = localStorage.getItem('session_expires');

      if (expires && new Date(expires) < new Date()) {
        handleLogout();
      }

      // Validate session with server
      if (token) {
        Promise.resolve(unifiedAuthService.getCurrentUser()).then(user => {
          if (!user) {
            handleLogout();
          }
        });
      }
    }, CHECK_INTERVAL_MS);

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('click', handleClickActivity);
      clearInterval(interval);
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, [lastActivity, resetActivityTimer, handleLogout]);

  return (
    <>
      {children}

      {/* Session Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <h2 className="text-xl font-bold text-gray-800">Session Expiring Soon</h2>
            </div>

            <p className="text-gray-600 mb-6">
              Your session will expire due to inactivity. You will be automatically logged out for
              security.
            </p>

            <div className="flex items-center justify-center mb-6">
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-800">{formatTime(timeRemaining)}</p>
                <p className="text-sm text-gray-500">Time remaining</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={continueSession}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Continue Working
              </button>
              <button
                onClick={() => handleLogout('manual')}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Timer & Logout Button (minimal, HIPAA compliant) */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 z-30">
        {/* Logout Button */}
        <button
          onClick={() => handleLogout('manual')}
          className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs hover:bg-gray-50 transition flex items-center gap-1"
          title="Logout"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>

        {/* Session Timer (only show when warning) */}
        {timeRemaining < WARNING_BEFORE_TIMEOUT_MS && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm px-3 py-2 animate-pulse">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="font-medium text-red-600">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
