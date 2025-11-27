/**
 * usePCMLabs Hook
 * React hook for managing PCM lab orders
 * Created: 2025-01-26
 */

import { useState, useEffect, useCallback } from 'react';
import { pcmDatabaseService } from '../services/pcmDatabase.service';
import type {
  PCMLabOrder,
  CreatePCMLabOrderInput,
  UpdatePCMLabOrderInput,
  PCMLabOrderFilters
} from '../types/pcm.database.types';
import type { OrderExtractionResult } from '../services/orderExtraction.service';

interface UsePCMLabsOptions {
  patientId?: string;
  staffId?: string;
  filters?: PCMLabOrderFilters;
  autoLoad?: boolean;
}

interface UsePCMLabsReturn {
  labOrders: PCMLabOrder[];
  pendingLabs: PCMLabOrder[];
  isLoading: boolean;
  error: string | null;
  createLabOrder: (data: CreatePCMLabOrderInput) => Promise<PCMLabOrder | null>;
  createLabsFromExtraction: (
    extraction: OrderExtractionResult,
    patientId: string,
    enrollmentId: string,
    providerId: string,
    providerName: string
  ) => Promise<{ created: number; orders: PCMLabOrder[] } | null>;
  updateLabOrder: (orderId: string, updates: UpdatePCMLabOrderInput) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePCMLabs(options: UsePCMLabsOptions = {}): UsePCMLabsReturn {
  const { patientId, staffId, filters, autoLoad = true } = options;

  const [labOrders, setLabOrders] = useState<PCMLabOrder[]>([]);
  const [pendingLabs, setPendingLabs] = useState<PCMLabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load lab orders
   */
  const loadLabOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build filters
      const queryFilters: PCMLabOrderFilters = {
        ...filters,
        patient_id: patientId,
        ordered_by: staffId
      };

      // Get all orders (would use filters in production)
      const pending = await pcmDatabaseService.getPendingLabs(staffId);
      setPendingLabs(pending);

      // If patient ID provided, get all orders for that patient
      if (patientId) {
        // Note: Would need to add getLabOrders method to service
        // For now, filter pending labs
        const patientLabs = pending.filter(lab => lab.patient_id === patientId);
        setLabOrders(patientLabs);
      } else {
        setLabOrders(pending);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lab orders';
      setError(message);
      console.error('Error loading lab orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, staffId, filters]);

  /**
   * Create a lab order
   */
  const createLabOrder = useCallback(async (
    data: CreatePCMLabOrderInput
  ): Promise<PCMLabOrder | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const order = await pcmDatabaseService.createLabOrder(data);
      await loadLabOrders(); // Refresh list
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create lab order';
      setError(message);
      console.error('Error creating lab order:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadLabOrders]);

  /**
   * Create lab orders from AI extraction (dictation)
   */
  const createLabsFromExtraction = useCallback(async (
    extraction: OrderExtractionResult,
    patId: string,
    enrollId: string,
    provId: string,
    provName: string
  ): Promise<{ created: number; orders: PCMLabOrder[] } | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await pcmDatabaseService.createLabOrdersFromExtraction(
        extraction,
        patId,
        enrollId,
        provId,
        provName
      );
      await loadLabOrders(); // Refresh list
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create labs from extraction';
      setError(message);
      console.error('Error creating labs from extraction:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadLabOrders]);

  /**
   * Update a lab order
   */
  const updateLabOrder = useCallback(async (
    orderId: string,
    updates: UpdatePCMLabOrderInput
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await pcmDatabaseService.updateLabOrder(orderId, updates);
      await loadLabOrders(); // Refresh list
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update lab order';
      setError(message);
      console.error('Error updating lab order:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadLabOrders]);

  /**
   * Refresh lab orders
   */
  const refresh = useCallback(async () => {
    await loadLabOrders();
  }, [loadLabOrders]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadLabOrders();
    }
  }, [autoLoad, loadLabOrders]);

  return {
    labOrders,
    pendingLabs,
    isLoading,
    error,
    createLabOrder,
    createLabsFromExtraction,
    updateLabOrder,
    refresh
  };
}
