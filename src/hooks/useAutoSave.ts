import { useEffect, useRef, useState, useCallback } from 'react';
import { pumpContext7Service } from '../services/pumpDriveContext7.service';
import { AutoSaveState } from '../types/context7.types';
import { logDebug, logInfo } from '../services/logger.service';

interface UseAutoSaveOptions {
  userId: string | undefined;
  responses: Record<string, number>;
  priorities: string[];
  selectedFeatures?: any[];
  freeText?: string;
  totalQuestions: number;
  interval?: number; // milliseconds
  enabled?: boolean;
}

export function useAutoSave({
  userId,
  responses,
  priorities,
  selectedFeatures = [],
  freeText = '',
  totalQuestions,
  interval = 30000, // 30 seconds default
  enabled = true,
}: UseAutoSaveOptions) {
  const [saveState, setSaveState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    saveStatus: 'idle',
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveDataRef = useRef<string>('');

  // Save function
  const save = useCallback(() => {
    if (!userId || !enabled) return;

    try {
      setSaveState(prev => ({ ...prev, isSaving: true, saveStatus: 'saving' }));

      const completedQuestions = Object.keys(responses).filter(
        key => responses[key] !== undefined && responses[key] !== 5 // 5 is default
      );

      pumpContext7Service.saveSession(
        userId,
        responses,
        priorities,
        selectedFeatures,
        freeText,
        completedQuestions,
        totalQuestions
      );

      const now = Date.now();
      setSaveState({
        isSaving: false,
        lastSaved: now,
        saveStatus: 'saved',
      });

      logInfo('autosave', 'Session auto-saved', {
        completedQuestions: completedQuestions.length,
        totalQuestions,
      });

      // Reset status to idle after 2 seconds
      setTimeout(() => {
        setSaveState(prev => ({ ...prev, saveStatus: 'idle' }));
      }, 2000);
    } catch (error) {
      setSaveState({
        isSaving: false,
        lastSaved: null,
        saveStatus: 'error',
        error: error instanceof Error ? error.message : 'Save failed',
      });
    }
  }, [userId, responses, priorities, selectedFeatures, freeText, totalQuestions, enabled]);

  // Debounced save on data change
  useEffect(() => {
    if (!enabled || !userId) return;

    // Check if data actually changed
    const currentData = JSON.stringify({ responses, priorities, selectedFeatures, freeText });
    if (currentData === lastSaveDataRef.current) return;

    lastSaveDataRef.current = currentData;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (debounce)
    saveTimeoutRef.current = setTimeout(() => {
      save();
    }, 2000); // 2 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [responses, priorities, selectedFeatures, freeText, enabled, userId, save]);

  // Periodic auto-save
  useEffect(() => {
    if (!enabled || !userId) return;

    const intervalId = setInterval(() => {
      save();
    }, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, userId, interval, save]);

  // Save on page unload
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleBeforeUnload = () => {
      save();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        save();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, userId, save]);

  // Manual save function
  const manualSave = useCallback(() => {
    save();
  }, [save]);

  return {
    ...saveState,
    manualSave,
  };
}
