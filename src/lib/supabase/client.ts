import { createClient } from '@supabase/supabase-js';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

// These should be in environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // HIPAA compliance settings
  global: {
    headers: {
      'x-client-info': 'medical-app',
    },
  },
});

// Helper function for real-time subscriptions
export const subscribeToChanges = (
  table: string,
  filter?: { column: string; value: string },
  callback?: (payload: any) => void
) => {
  const channel = filter
    ? supabase.channel(`${table}_changes`).on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${filter.column}=eq.${filter.value}`,
        },
        payload => {
          logDebug('App', 'Debug message', {});
          callback?.(payload);
        }
      )
    : supabase.channel(`${table}_changes`).on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        payload => {
          logDebug('App', 'Debug message', {});
          callback?.(payload);
        }
      );

  channel.subscribe();
  return channel;
};

// HIPAA audit logging helper
export const auditLog = async (
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  details?: any
) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      details,
      ip_address: typeof window !== 'undefined' ? window.location.hostname : 'server',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      created_at: new Date().toISOString(),
    });

    if (error) logError('App', 'Error message', {});
  } catch (err) {
    logError('App', 'Error message', {});
  }
};
