/**
 * usePCMEnrollment Hook
 * React hook for managing PCM patient enrollments
 * Created: 2025-01-26
 */

import { useState, useEffect, useCallback } from 'react';
import { pcmDatabaseService } from '../services/pcmDatabase.service';
import type {
  PCMEnrollment,
  PCMPatientSummary,
  CreatePCMEnrollmentInput,
  UpdatePCMEnrollmentInput,
  PCMEnrollmentFilters
} from '../types/pcm.database.types';

interface UsePCMEnrollmentOptions {
  patientId?: string;
  filters?: PCMEnrollmentFilters;
  autoLoad?: boolean;
}

interface UsePCMEnrollmentReturn {
  enrollment: PCMEnrollment | null;
  enrollments: PCMEnrollment[];
  patientSummary: PCMPatientSummary | null;
  isLoading: boolean;
  error: string | null;
  enrollPatient: (data: CreatePCMEnrollmentInput) => Promise<PCMEnrollment | null>;
  updateEnrollment: (updates: UpdatePCMEnrollmentInput) => Promise<boolean>;
  refreshEnrollment: () => Promise<void>;
  refreshEnrollments: () => Promise<void>;
  loadPatientSummary: (patientId: string) => Promise<void>;
}

export function usePCMEnrollment(options: UsePCMEnrollmentOptions = {}): UsePCMEnrollmentReturn {
  const { patientId, filters, autoLoad = true } = options;

  const [enrollment, setEnrollment] = useState<PCMEnrollment | null>(null);
  const [enrollments, setEnrollments] = useState<PCMEnrollment[]>([]);
  const [patientSummary, setPatientSummary] = useState<PCMPatientSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load single patient enrollment
   */
  const loadEnrollment = useCallback(async (pid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await pcmDatabaseService.getPCMEnrollment(pid);
      setEnrollment(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load enrollment';
      setError(message);
      console.error('Error loading PCM enrollment:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load multiple enrollments with filters
   */
  const loadEnrollments = useCallback(async (queryFilters?: PCMEnrollmentFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await pcmDatabaseService.getPCMEnrollments(queryFilters);
      setEnrollments(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load enrollments';
      setError(message);
      console.error('Error loading PCM enrollments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load patient summary (enrollment + stats)
   */
  const loadPatientSummary = useCallback(async (pid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await pcmDatabaseService.getPatientSummary(pid);
      setPatientSummary(summary);
      if (summary) {
        setEnrollment(summary.enrollment);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load patient summary';
      setError(message);
      console.error('Error loading patient summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Enroll a new patient
   */
  const enrollPatient = useCallback(async (data: CreatePCMEnrollmentInput): Promise<PCMEnrollment | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const newEnrollment = await pcmDatabaseService.enrollPatient(data);
      setEnrollment(newEnrollment);
      return newEnrollment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enroll patient';
      setError(message);
      console.error('Error enrolling patient:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update enrollment
   */
  const updateEnrollment = useCallback(async (updates: UpdatePCMEnrollmentInput): Promise<boolean> => {
    if (!enrollment) {
      setError('No enrollment loaded');
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      const updated = await pcmDatabaseService.updatePCMEnrollment(enrollment.id, updates);
      setEnrollment(updated);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update enrollment';
      setError(message);
      console.error('Error updating enrollment:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [enrollment]);

  /**
   * Refresh current enrollment
   */
  const refreshEnrollment = useCallback(async () => {
    if (patientId) {
      await loadEnrollment(patientId);
    }
  }, [patientId, loadEnrollment]);

  /**
   * Refresh enrollments list
   */
  const refreshEnrollments = useCallback(async () => {
    await loadEnrollments(filters);
  }, [filters, loadEnrollments]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      if (patientId) {
        loadEnrollment(patientId);
      } else if (filters) {
        loadEnrollments(filters);
      }
    }
  }, [patientId, filters, autoLoad, loadEnrollment, loadEnrollments]);

  return {
    enrollment,
    enrollments,
    patientSummary,
    isLoading,
    error,
    enrollPatient,
    updateEnrollment,
    refreshEnrollment,
    refreshEnrollments,
    loadPatientSummary
  };
}
