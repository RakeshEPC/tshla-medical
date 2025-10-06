import React from 'react';
import { AutoSaveState } from '../types/context7.types';

interface AutoSaveIndicatorProps {
  saveState: AutoSaveState;
}

export function AutoSaveIndicator({ saveState }: AutoSaveIndicatorProps) {
  const { saveStatus, lastSaved, error } = saveState;

  const formatLastSaved = (timestamp: number | null) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);

    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  if (saveStatus === 'idle') return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {saveStatus === 'saving' && (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-gray-600">Saving...</span>
        </>
      )}

      {saveStatus === 'saved' && (
        <>
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-gray-600">
            All changes saved {lastSaved && `• ${formatLastSaved(lastSaved)}`}
          </span>
        </>
      )}

      {saveStatus === 'error' && (
        <>
          <svg
            className="h-4 w-4 text-red-500"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-red-600">{error || 'Save failed'}</span>
        </>
      )}
    </div>
  );
}
