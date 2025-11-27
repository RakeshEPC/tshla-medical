/**
 * usePCMRealtime Hook
 * React hook for real-time PCM updates via Supabase subscriptions
 * Created: 2025-01-26
 */

import { useEffect, useCallback, useRef } from 'react';
import { pcmDatabaseService } from '../services/pcmDatabase.service';
import type { PCMVital, PCMLabOrder } from '../types/pcm.database.types';

interface UsePCMRealtimeOptions {
  onAbnormalVital?: (vital: PCMVital) => void;
  onUrgentLab?: (lab: PCMLabOrder) => void;
  enabled?: boolean;
}

interface UsePCMRealtimeReturn {
  isConnected: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
}

export function usePCMRealtime(options: UsePCMRealtimeOptions = {}): UsePCMRealtimeReturn {
  const { onAbnormalVital, onUrgentLab, enabled = true } = options;

  const subscriptionIdsRef = useRef<string[]>([]);
  const isConnectedRef = useRef(false);

  /**
   * Subscribe to real-time updates
   */
  const subscribe = useCallback(() => {
    if (isConnectedRef.current) {
      console.warn('Already subscribed to PCM realtime updates');
      return;
    }

    console.log('🔔 Subscribing to PCM realtime updates...');

    // Subscribe to abnormal vitals
    if (onAbnormalVital) {
      const vitalSubId = pcmDatabaseService.subscribeToAbnormalVitals((vital) => {
        console.log('⚠️ Abnormal vital detected:', vital);
        onAbnormalVital(vital);
      });
      subscriptionIdsRef.current.push(vitalSubId);
    }

    // Subscribe to urgent labs
    if (onUrgentLab) {
      const labSubId = pcmDatabaseService.subscribeToUrgentLabs((lab) => {
        console.log('🚨 Urgent lab order created:', lab);
        onUrgentLab(lab);
      });
      subscriptionIdsRef.current.push(labSubId);
    }

    isConnectedRef.current = true;
    console.log(`✅ Subscribed to ${subscriptionIdsRef.current.length} PCM channels`);
  }, [onAbnormalVital, onUrgentLab]);

  /**
   * Unsubscribe from all real-time updates
   */
  const unsubscribe = useCallback(() => {
    if (!isConnectedRef.current) {
      return;
    }

    console.log('🔕 Unsubscribing from PCM realtime updates...');

    subscriptionIdsRef.current.forEach((subId) => {
      pcmDatabaseService.unsubscribe(subId);
    });

    subscriptionIdsRef.current = [];
    isConnectedRef.current = false;
    console.log('✅ Unsubscribed from all PCM channels');
  }, []);

  // Auto-subscribe on mount if enabled
  useEffect(() => {
    if (enabled && (onAbnormalVital || onUrgentLab)) {
      subscribe();

      return () => {
        unsubscribe();
      };
    }
  }, [enabled, onAbnormalVital, onUrgentLab, subscribe, unsubscribe]);

  return {
    isConnected: isConnectedRef.current,
    subscribe,
    unsubscribe
  };
}
