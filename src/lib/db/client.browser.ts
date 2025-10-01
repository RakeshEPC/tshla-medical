import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
// Browser-safe stub for database client
// Real database operations should happen on the server side only

// Generate a unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Stub for getDb function
export const getDb = () => db;

export const db = {
  query: async () => {
    logWarn('App', 'Warning message', {});
    return { rows: [] };
  },
  execute: async () => {
    logWarn('App', 'Warning message', {});
    return { rows: [] };
  },
  all: async () => {
    logWarn('App', 'Warning message', {});
    return [];
  },
  get: async () => {
    logWarn('App', 'Warning message', {});
    return null;
  },
  run: async () => {
    logWarn('App', 'Warning message', {});
    return { changes: 0, lastInsertRowid: 0 };
  },
  prepare: () => ({
    all: () => [],
    get: () => null,
    run: () => ({ changes: 0, lastInsertRowid: 0 }),
  }),
  transaction: (fn: Function) => fn,
};

export const hashPassword = async (password: string): Promise<string> => {
  // Use a browser-compatible hashing method
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

export const closeDatabase = () => {
  logDebug('App', 'Debug message', {});
};

export default db;
