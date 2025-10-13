/**
 * React Error Boundary for Authentication Errors
 * Catches and displays authentication-related errors gracefully
 */

import React, { Component, ReactNode } from 'react';
import { AuthErrorHandler } from '../utils/authErrorHandler';
import { logError } from '../services/logger.service';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('AuthErrorBoundary', 'Caught error in boundary', {
      error,
      errorInfo
    });

    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error display
      const authError = AuthErrorHandler.handle(this.state.error);

      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '2rem auto',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>
            Authentication Error
          </h2>

          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: '#333' }}>
            {authError.userMessage}
          </p>

          {authError.retry && (
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '1rem'
              }}
            >
              Try Again
            </button>
          )}

          <button
            onClick={() => window.location.href = '/login'}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              backgroundColor: '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Go to Login
          </button>

          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '2rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>
                Technical Details
              </summary>
              <pre style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '0.875rem',
                overflow: 'auto'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && (
                  '\n\nComponent Stack:\n' + this.state.errorInfo.componentStack
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
