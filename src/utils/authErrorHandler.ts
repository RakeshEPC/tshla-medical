/**
 * Centralized Authentication Error Handler
 * Provides consistent, user-friendly error messages for auth failures
 */

import { logError } from '../services/logger.service';

export interface AuthError {
  code: string;
  message: string;
  userMessage: string;
  retry: boolean;
}

export class AuthErrorHandler {
  /**
   * Convert Supabase/auth errors to user-friendly messages
   */
  static handle(error: any, context: string = 'Authentication'): AuthError {
    logError('AuthErrorHandler', `${context} error`, { error });

    // Handle Supabase auth errors
    if (error?.message) {
      const message = error.message.toLowerCase();

      // Invalid credentials
      if (message.includes('invalid login') || message.includes('invalid credentials')) {
        return {
          code: 'INVALID_CREDENTIALS',
          message: error.message,
          userMessage: 'Invalid email or password. Please try again.',
          retry: true
        };
      }

      // Email not confirmed
      if (message.includes('email not confirmed')) {
        return {
          code: 'EMAIL_NOT_CONFIRMED',
          message: error.message,
          userMessage: 'Please check your email and click the confirmation link.',
          retry: false
        };
      }

      // User not found
      if (message.includes('user not found') || message.includes('profile not found')) {
        return {
          code: 'USER_NOT_FOUND',
          message: error.message,
          userMessage: 'Account not found. Please check your email or register.',
          retry: false
        };
      }

      // RLS policy violation
      if (message.includes('row-level security') || message.includes('rls')) {
        return {
          code: 'PERMISSION_DENIED',
          message: error.message,
          userMessage: 'Access denied. Please contact support if this persists.',
          retry: false
        };
      }

      // Network errors
      if (message.includes('fetch') || message.includes('network')) {
        return {
          code: 'NETWORK_ERROR',
          message: error.message,
          userMessage: 'Network error. Please check your connection and try again.',
          retry: true
        };
      }

      // Session expired
      if (message.includes('session') || message.includes('token')) {
        return {
          code: 'SESSION_EXPIRED',
          message: error.message,
          userMessage: 'Your session has expired. Please log in again.',
          retry: false
        };
      }
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: error?.message || String(error),
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      retry: true
    };
  }

  /**
   * Format error for display to user
   */
  static getUserMessage(error: any, context: string = 'Authentication'): string {
    const authError = this.handle(error, context);
    return authError.userMessage;
  }

  /**
   * Check if error is retryable
   */
  static canRetry(error: any): boolean {
    const authError = this.handle(error);
    return authError.retry;
  }
}
