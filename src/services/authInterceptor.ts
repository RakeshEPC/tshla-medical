/**
 * Authentication Interceptor
 * Automatically handles 401/403 errors and re-authenticates user
 * Provides production-grade error recovery
 */

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

    // IMPORTANT: Don't clear tokens on results/assessment pages
    // Let the page handle auth errors gracefully without losing user's work
    const protectedPaths = ['/pumpdrive/results', '/pumpdrive/assessment', '/pumpdrive/report'];
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
      localStorage.removeItem('pump_auth_token');
      localStorage.removeItem('pump_user_data');
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
  // Clear all possible token storage locations
  localStorage.removeItem('auth_token');
  localStorage.removeItem('doctor_token');
  localStorage.removeItem('token');
  localStorage.removeItem('medical_token');
  localStorage.removeItem('user');
  localStorage.removeItem('userRole');

  // Clear session storage
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

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
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
  const token = localStorage.getItem('auth_token') || localStorage.getItem('doctor_token');

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
  const token = localStorage.getItem('auth_token') || localStorage.getItem('doctor_token');
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
