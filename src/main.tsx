// import { StrictMode } from 'react'  // DISABLED to prevent double mounting
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
// import App from './AppSimple.tsx'
import ErrorBoundary from './ErrorBoundary.tsx';
import { logError, logWarn, logInfo, logDebug } from './services/logger.service';

// Polyfill setup moved to index.html to avoid import issues

// Add error handling
window.addEventListener('error', e => {
  logError('App', 'Error message', {});
});

window.addEventListener('unhandledrejection', e => {
  logError('App', 'Error message', {});
});

createRoot(document.getElementById('root')!).render(
  // <StrictMode>  // DISABLED to prevent double mounting and double voice playback
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
  // </StrictMode>,
);
