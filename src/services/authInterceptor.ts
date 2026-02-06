/**
 * Authentication Interceptor
 * Automatically handles 401/403 errors and re-authenticates user
 * Provides production-grade error recovery
 *
 * Updated for HIPAA Phase 5: Uses encrypted storage for all auth tokens
 */

import { secureStorage } from './secureStorage.service';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

/**
 * Handle authentication errors
 * Automatically clears tokens and redirects to login
 */
export const handleAuthError = (error: any, isRetry = false): Promise<never> => {
  // If this is already a retry, don't retry again
  if (isRetry) {
    console.error('Auth retry failed, clearing session');
    clearAuthSession();
    return Promise.reject(error);
  }

  // Check if this is an auth error
  const status = error?.response?.status || error?.status;

  if (status === 401 || status === 403) {
    console.log('Authentication error detected, clearing session and redirecting to login');

    // Determine which auth system we're using based on current path
    const currentPath = window.location.pathname;
    const isPumpDrive = currentPath.startsWith('/pumpdrive');
    const isPatientPortal = currentPath.startsWith('/patient-portal') ||
                            currentPath.startsWith('/patient-hp-view');

    // IMPORTANT: Patient portal has its own auth system - don't interfere
    if (isPatientPortal) {
      console.log('⚠️ Auth error on patient portal - NOT intercepting, has own auth system');
      console.log('   Path:', currentPath);
      // Patient portal handles its own authentication, don't intercept
      return Promise.reject(error);
    }

    // IMPORTANT: Don't clear tokens on results/assessment/dictation pages
    // Let the page handle auth errors gracefully without losing user's work
    const protectedPaths = [
      '/pumpdrive/results',
      '/pumpdrive/assessment',
      '/pumpdrive/report',
      '/quick-note',
      '/dictation'
    ];
    const isProtectedPath = protectedPaths.some(path => currentPath.startsWith(path));

    if (isProtectedPath) {
      console.log('⚠️ Auth error on protected path - NOT clearing tokens, letting page handle it');
      console.log('   Path:', currentPath);
      // Just reject the error, don't clear storage or redirect
      // The individual page components can decide how to handle auth failures
      return Promise.reject(error);
    }

    // Clear appropriate auth tokens
    if (isPumpDrive) {
      // Clear only PumpDrive tokens, not medical app tokens
      secureStorage.removeItem('pump_auth_token');
      secureStorage.removeItem('pump_user_data');
      console.log('PumpDrive auth cleared');
    } else {
      // Clear all medical app auth tokens
      clearAuthSession();
    }

    // Show user-friendly message
    const message = 'Your session has expired. Please login again.';

    // Store the current path to redirect back after login
    if (isPumpDrive) {
      sessionStorage.setItem('pumpDriveRedirectAfterLogin', currentPath);
      // Redirect to PumpDrive login
      window.location.href = `/pumpdrive/login?message=${encodeURIComponent(message)}`;
    } else {
      if (currentPath !== '/login' && currentPath !== '/') {
        sessionStorage.setItem('redirect_after_login', currentPath);
      }
      // Redirect to main medical app login
      window.location.href = `/login?message=${encodeURIComponent(message)}`;
    }
  }

  return Promise.reject(error);
};

/**
 * Clear all authentication session data
 */
export const clearAuthSession = () => {
  // Clear all possible token storage locations (encrypted storage)
  secureStorage.removeItem('auth_token');
  secureStorage.removeItem('doctor_token');
  secureStorage.removeItem('token');
  secureStorage.removeItem('medical_token');
  secureStorage.removeItem('user');
  secureStorage.removeItem('userRole');
  secureStorage.removeItem('user_data');

  // Clear session storage (these are not encrypted as they're session-only)
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('user');

  console.log('Auth session cleared');
};

/**
 * Setup fetch interceptor
 * Wraps native fetch to automatically handle auth errors
 */
export const setupFetchInterceptor = () => {
  const originalFetch = window.fetch;

  window.fetch = async (...args): Promise<Response> => {
    try {
      const response = await originalFetch(...args);

      // Get the request URL
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      // SKIP auth interception for admin API calls
      // Let the admin UI handle errors gracefully with proper error messages
      const isAdminApi = requestUrl.includes('tshla-admin-api-container') ||
                         requestUrl.includes('/api/accounts/');

      // SKIP auth interception for Supabase API calls
      // Supabase has its own auth handling and we don't want to interfere
      const isSupabaseApi = requestUrl.includes('supabase.co') ||
                            requestUrl.includes('.supabase.');

      // SKIP auth interception for Deepgram proxy calls
      // Deepgram health checks should never trigger auth redirects
      const isDeepgramProxy = requestUrl.includes('deepgram') ||
                             requestUrl.includes(':8080') ||
                             requestUrl.includes('localhost:8080') ||
                             requestUrl.includes('/health');

      // SKIP auth interception for diabetes education API calls
      // These are authenticated via JWT tokens, not Supabase session redirects
      const isDiabetesEducationApi = requestUrl.includes('/api/diabetes-education');

      // SKIP auth interception for patient summary portal (PUBLIC - TSHLA ID verification only)
      // Patient summaries are public links that require TSHLA ID verification, not login
      const isPatientSummaryApi = requestUrl.includes('/api/patient-summaries');

      // SKIP auth interception for patient chart and patient portal APIs
      // These may return 401 for unauthenticated resources without meaning the user's session is invalid
      const isPatientChartApi = requestUrl.includes('/api/patient-chart') ||
                                requestUrl.includes('/api/patient-portal') ||
                                requestUrl.includes('/api/hp/');

      // SKIP auth interception for admin routes
      const currentPath = window.location.pathname;
      const isAdminRoute = currentPath.startsWith('/admin');
      const isPatientSummaryRoute = currentPath.startsWith('/patient-summary');
      const isPatientChartRoute = currentPath.startsWith('/patient-chart');

      if (isAdminApi || isAdminRoute || isSupabaseApi || isDeepgramProxy || isDiabetesEducationApi || isPatientSummaryApi || isPatientSummaryRoute || isPatientChartApi || isPatientChartRoute) {
        console.log('🔓 [AuthInterceptor] SKIPPING interception for:', {
          url: requestUrl,
          path: currentPath,
          status: response.status,
          reason: isAdminApi ? 'Admin API call' :
                  isAdminRoute ? 'Admin route' :
                  isSupabaseApi ? 'Supabase API call' :
                  isDiabetesEducationApi ? 'Diabetes Education API call' :
                  isPatientSummaryApi ? 'Patient Summary API call (public)' :
                  isPatientSummaryRoute ? 'Patient Summary route (public)' :
                  isPatientChartApi ? 'Patient Chart API call' :
                  isPatientChartRoute ? 'Patient Chart route' :
                  'Deepgram proxy call'
        });
        // Return the response as-is, let the calling code handle errors
        return response;
      }

      // Check for auth errors on non-admin requests
      if (response.status === 401 || response.status === 403) {
        // IMPORTANT: If user has been authenticated in this session, don't redirect
        // This prevents redirect loops during navigation when API calls briefly fail
        const hasBeenAuthed = sessionStorage.getItem('protected_route_authed') === 'true';
        if (hasBeenAuthed) {
          console.log('🔓 [AuthInterceptor] 401/403 detected but user was previously authenticated - NOT redirecting', {
            url: requestUrl,
            status: response.status,
            path: currentPath
          });
          return response;
        }

        console.log('🚨 [AuthInterceptor] Auth error detected - WILL TRIGGER REDIRECT:', {
          url: requestUrl,
          status: response.status,
          path: currentPath,
          note: 'This error was NOT skipped - check skip conditions above'
        });

        // Clone the response for error handling
        const clonedResponse = response.clone();

        // Handle auth error
        await handleAuthError({
          response: {
            status: response.status,
            statusText: response.statusText
          }
        });

        return clonedResponse;
      }

      return response;
    } catch (error) {
      // Network or other errors
      throw error;
    }
  };

  console.log('Fetch interceptor initialized');
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Assume expired if we can't parse it
  }
};

/**
 * Get valid auth token
 * Returns null if token is expired or missing
 */
export const getValidAuthToken = (): string | null => {
  const token = secureStorage.getItem('auth_token') || secureStorage.getItem('doctor_token');

  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    console.log('Token expired, clearing session');
    clearAuthSession();
    return null;
  }

  return token;
};

/**
 * Initialize auth interceptor
 * Call this once when the app starts
 */
export const initializeAuthInterceptor = () => {
  setupFetchInterceptor();

  // Check token on page load
  const token = secureStorage.getItem('auth_token') || secureStorage.getItem('doctor_token');
  if (token && isTokenExpired(token)) {
    console.log('Found expired token on startup, clearing session');
    clearAuthSession();
  }

  console.log('Auth interceptor initialized');
};

export default {
  handleAuthError,
  clearAuthSession,
  setupFetchInterceptor,
  isTokenExpired,
  getValidAuthToken,
  initializeAuthInterceptor
};
