// import { StrictMode } from 'react'  // DISABLED to prevent double mounting
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/modernUI.css';
import App from './App.tsx';
// import App from './AppSimple.tsx'
import ErrorBoundary from './ErrorBoundary.tsx';
import { logError, logInfo } from './services/logger.service';
import { initializeAuthInterceptor } from './services/authInterceptor';

// Polyfill setup moved to index.html to avoid import issues

// ============================================================================
// HIPAA SECURITY: Validate critical configuration before app starts
// §164.312(a)(2)(iv) - Encryption and Decryption
// ============================================================================
if (!import.meta.env.VITE_ENCRYPTION_KEY) {
  document.body.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-width: 500px;
        text-align: center;
      ">
        <h1 style="color: #d32f2f; margin-bottom: 16px;">⚠️ Configuration Error</h1>
        <p style="color: #666; margin-bottom: 24px;">
          Critical security settings are missing. The application cannot start without proper encryption configuration.
        </p>
        <p style="color: #999; font-size: 14px; margin-bottom: 8px;">
          Please contact your system administrator.
        </p>
        <p style="color: #ccc; font-size: 12px; font-family: monospace;">
          Error Code: ENC-001 - VITE_ENCRYPTION_KEY not configured
        </p>
      </div>
    </div>
  `;
  throw new Error('FATAL: VITE_ENCRYPTION_KEY not configured - cannot start application');
}

// Validate key strength
if (import.meta.env.VITE_ENCRYPTION_KEY.length < 32) {
  document.body.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-width: 500px;
        text-align: center;
      ">
        <h1 style="color: #d32f2f; margin-bottom: 16px;">⚠️ Configuration Error</h1>
        <p style="color: #666; margin-bottom: 24px;">
          Encryption key does not meet minimum security requirements.
        </p>
        <p style="color: #999; font-size: 14px; margin-bottom: 8px;">
          Please contact your system administrator.
        </p>
        <p style="color: #ccc; font-size: 12px; font-family: monospace;">
          Error Code: ENC-002 - Encryption key too weak (minimum 32 characters required)
        </p>
      </div>
    </div>
  `;
  throw new Error('FATAL: Encryption key too weak - cannot start application');
}

logInfo('Startup', 'Encryption configuration validated successfully');

// Initialize authentication interceptor for automatic error recovery
initializeAuthInterceptor();

// Add error handling
window.addEventListener('error', () => {
  logError('App', 'Error message', {});
});

window.addEventListener('unhandledrejection', () => {
  logError('App', 'Error message', {});
});

createRoot(document.getElementById('root')!).render(
  // <StrictMode>  // DISABLED to prevent double mounting and double voice playback
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
  // </StrictMode>,
);
// Build trigger 1765162682
