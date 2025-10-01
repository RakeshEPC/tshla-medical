import React from 'react';
import { logError, logWarn, logInfo, logDebug } from './services/logger.service';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('App', 'Error message', {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee', border: '1px solid red' }}>
          <h1>Application Error</h1>
          <p>The app failed to load due to an error:</p>
          <pre style={{ backgroundColor: '#fff', padding: '10px', overflow: 'auto' }}>
            {this.state.error?.toString()}
            {'\n\nStack:\n'}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
