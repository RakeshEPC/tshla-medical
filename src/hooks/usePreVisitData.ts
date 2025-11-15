/**
 * usePreVisitData Hook
 * React hook for fetching and managing pre-visit data
 * Created: January 2025
 */

import { useState, useEffect } from 'react';
import {
  getPreVisitDataByPatientId,
  getPreVisitDataByAppointmentId,
  getPreVisitDataBatch,
} from '../services/previsit.service';
import type { PreVisitData } from '../components/previsit/PreVisitSummaryCard';

interface UsePreVisitDataOptions {
  patientId?: string;
  appointmentId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export function usePreVisitData(options: UsePreVisitDataOptions) {
  const [data, setData] = useState<PreVisitData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let result: PreVisitData | null = null;

      if (options.patientId) {
        result = await getPreVisitDataByPatientId(options.patientId);
      } else if (options.appointmentId) {
        result = await getPreVisitDataByAppointmentId(options.appointmentId);
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pre-visit data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (options.patientId || options.appointmentId) {
      fetchData();
    }
  }, [options.patientId, options.appointmentId]);

  // Auto-refresh
  useEffect(() => {
    if (options.autoRefresh && (options.patientId || options.appointmentId)) {
      const interval = setInterval(
        fetchData,
        options.refreshInterval || 60000 // Default 60 seconds
      );

      return () => clearInterval(interval);
    }
  }, [options.autoRefresh, options.refreshInterval, options.patientId, options.appointmentId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for fetching pre-visit data for multiple patients
 */
export function usePreVisitDataBatch(patientIds: string[]) {
  const [dataMap, setDataMap] = useState<Map<string, PreVisitData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (patientIds.length === 0) {
      setDataMap(new Map());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await getPreVisitDataBatch(patientIds);
      setDataMap(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pre-visit data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [patientIds.join(',')]); // Re-fetch when patient IDs change

  return {
    dataMap,
    isLoading,
    error,
    refetch: fetchData,
    getDataForPatient: (patientId: string) => dataMap.get(patientId) || null,
  };
}
