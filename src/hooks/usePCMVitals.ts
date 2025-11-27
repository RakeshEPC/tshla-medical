/**
 * usePCMVitals Hook
 * React hook for managing PCM patient vitals
 * Created: 2025-01-26
 */

import { useState, useEffect, useCallback } from 'react';
import { pcmDatabaseService } from '../services/pcmDatabase.service';
import type {
  PCMVital,
  CreatePCMVitalInput,
  VitalTrend
} from '../types/pcm.database.types';

interface UsePCMVitalsOptions {
  patientId: string;
  limit?: number;
  autoLoad?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UsePCMVitalsReturn {
  vitals: PCMVital[];
  latestVitals: PCMVital | null;
  bloodSugarTrend: VitalTrend | null;
  bpTrend: VitalTrend | null;
  weightTrend: VitalTrend | null;
  isLoading: boolean;
  error: string | null;
  recordVitals: (data: Omit<CreatePCMVitalInput, 'patient_id' | 'enrollment_id'>) => Promise<PCMVital | null>;
  refresh: () => Promise<void>;
  loadTrends: (days?: number) => Promise<void>;
}

export function usePCMVitals(options: UsePCMVitalsOptions): UsePCMVitalsReturn {
  const {
    patientId,
    limit = 30,
    autoLoad = true,
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;

  const [vitals, setVitals] = useState<PCMVital[]>([]);
  const [latestVitals, setLatestVitals] = useState<PCMVital | null>(null);
  const [bloodSugarTrend, setBloodSugarTrend] = useState<VitalTrend | null>(null);
  const [bpTrend, setBpTrend] = useState<VitalTrend | null>(null);
  const [weightTrend, setWeightTrend] = useState<VitalTrend | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load patient vitals
   */
  const loadVitals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await pcmDatabaseService.getPatientVitals(patientId, limit);
      setVitals(data);
      if (data.length > 0) {
        setLatestVitals(data[0]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load vitals';
      setError(message);
      console.error('Error loading vitals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, limit]);

  /**
   * Load vital trends
   */
  const loadTrends = useCallback(async (days = 90) => {
    setIsLoading(true);
    setError(null);
    try {
      const [bgTrend, bpTrendData, wtTrend] = await Promise.all([
        pcmDatabaseService.getVitalTrends(patientId, 'blood_sugar', days),
        pcmDatabaseService.getVitalTrends(patientId, 'bp_systolic', days),
        pcmDatabaseService.getVitalTrends(patientId, 'weight', days)
      ]);

      setBloodSugarTrend(bgTrend);
      setBpTrend(bpTrendData);
      setWeightTrend(wtTrend);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load trends';
      setError(message);
      console.error('Error loading vital trends:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  /**
   * Record new vitals
   */
  const recordVitals = useCallback(async (
    data: Omit<CreatePCMVitalInput, 'patient_id' | 'enrollment_id'>
  ): Promise<PCMVital | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // Get enrollment ID
      const enrollment = await pcmDatabaseService.getPCMEnrollment(patientId);
      if (!enrollment) {
        throw new Error('Patient not enrolled in PCM');
      }

      const vital = await pcmDatabaseService.recordVitals({
        ...data,
        patient_id: patientId,
        enrollment_id: enrollment.id
      });

      // Refresh vitals list
      await loadVitals();

      return vital;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record vitals';
      setError(message);
      console.error('Error recording vitals:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [patientId, loadVitals]);

  /**
   * Refresh vitals
   */
  const refresh = useCallback(async () => {
    await loadVitals();
  }, [loadVitals]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && patientId) {
      loadVitals();
    }
  }, [patientId, autoLoad, loadVitals]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && patientId) {
      const interval = setInterval(() => {
        loadVitals();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, patientId, refreshInterval, loadVitals]);

  return {
    vitals,
    latestVitals,
    bloodSugarTrend,
    bpTrend,
    weightTrend,
    isLoading,
    error,
    recordVitals,
    refresh,
    loadTrends
  };
}
