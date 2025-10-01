/**
 * Browser-Compatible Database Client
 * Uses IndexedDB for persistent storage in the browser
 */

export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<any>;
  queryOne: (sql: string, params?: any[]) => Promise<any>;
  execute: (sql: string, params?: any[]) => Promise<any>;
  transaction: (callback: (client: DbClient) => Promise<void>) => Promise<void>;
}

class BrowserDatabase implements DbClient {
  private dbName = 'tshla_medical_db';
  private version = 2; // Increment version to trigger upgrade
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create appointments store
        if (!db.objectStoreNames.contains('appointments')) {
          const appointmentsStore = db.createObjectStore('appointments', { keyPath: 'id' });
          appointmentsStore.createIndex('doctor_id', 'doctor_id', { unique: false });
          appointmentsStore.createIndex('appointment_date', 'appointment_date', { unique: false });
          appointmentsStore.createIndex('appointment_slot', 'appointment_slot', { unique: false });
          appointmentsStore.createIndex('doctor_slot', ['doctor_id', 'appointment_slot'], {
            unique: true,
          });
        }

        // Create doctors store
        if (!db.objectStoreNames.contains('doctors')) {
          const doctorsStore = db.createObjectStore('doctors', { keyPath: 'id' });
          doctorsStore.createIndex('email', 'email', { unique: true });
        }

        // Create patients_master store with triple IDs
        if (!db.objectStoreNames.contains('patients_master')) {
          const patientsStore = db.createObjectStore('patients_master', { keyPath: 'patient_id' });
          patientsStore.createIndex('emr_number', 'emr_number', { unique: false });
          patientsStore.createIndex('ava_number', 'ava_number', { unique: true });
          patientsStore.createIndex('tsh_number', 'tsh_number', { unique: true });
          patientsStore.createIndex('name_dob', ['name', 'dob'], { unique: false });
          patientsStore.createIndex('email', 'email', { unique: false });
          patientsStore.createIndex('created_by_ma_id', 'created_by_ma_id', { unique: false });
        }

        // Create orders store for MA workflow
        if (!db.objectStoreNames.contains('orders')) {
          const ordersStore = db.createObjectStore('orders', { keyPath: 'order_id' });
          ordersStore.createIndex('patient_id', 'patient_id', { unique: false });
          ordersStore.createIndex('doctor_id', 'doctor_id', { unique: false });
          ordersStore.createIndex('ma_id', 'ma_id', { unique: false });
          ordersStore.createIndex('status', 'status', { unique: false });
          ordersStore.createIndex('order_type', 'order_type', { unique: false });
          ordersStore.createIndex('created_at', 'created_at', { unique: false });
          ordersStore.createIndex('doctor_status', ['doctor_id', 'status'], { unique: false });
        }

        // Create ma_actions_log for audit trail
        if (!db.objectStoreNames.contains('ma_actions_log')) {
          const actionsStore = db.createObjectStore('ma_actions_log', { keyPath: 'log_id' });
          actionsStore.createIndex('ma_id', 'ma_id', { unique: false });
          actionsStore.createIndex('patient_id', 'patient_id', { unique: false });
          actionsStore.createIndex('action_type', 'action_type', { unique: false });
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create patient_summaries for 2-3 sentence summaries
        if (!db.objectStoreNames.contains('patient_summaries')) {
          const summariesStore = db.createObjectStore('patient_summaries', {
            keyPath: 'summary_id',
          });
          summariesStore.createIndex('patient_id', 'patient_id', { unique: false });
          summariesStore.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
  }

  async query(storeName: string, params?: any[]): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result;

        // Apply basic filtering if params provided
        if (params && params.length > 0) {
          const [doctorId, date] = params;
          if (storeName === 'appointments' && doctorId) {
            results = results.filter((a: any) => {
              const matchDoctor = !doctorId || a.doctor_id === doctorId;
              const matchDate = !date || a.appointment_date === date;
              const notDeleted = !a.is_deleted;
              return matchDoctor && matchDate && notDeleted;
            });
          }
        }

        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async queryOne(storeName: string, id: string): Promise<any> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async execute(operation: string, data?: any): Promise<any> {
    if (!this.db) await this.init();

    const [action, storeName] = operation.split(':');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      let request: IDBRequest;

      switch (action) {
        case 'add':
          request = store.add(data);
          break;
        case 'put':
          request = store.put(data);
          break;
        case 'delete':
          request = store.delete(data);
          break;
        default:
          reject(new Error(`Unknown operation: ${action}`));
          return;
      }

      request.onsuccess = () => resolve({ success: true, id: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  async transaction(callback: (client: DbClient) => Promise<void>): Promise<void> {
    // IndexedDB handles transactions automatically
    await callback(this);
  }
}

// Export singleton instance
let dbInstance: BrowserDatabase | null = null;

export function getDb(): DbClient {
  if (!dbInstance) {
    dbInstance = new BrowserDatabase();
  }
  return dbInstance;
}

// Helper to generate UUID (browser-compatible)
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper for password hashing (using Web Crypto API)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const testHash = await hashPassword(password);
  return testHash === hash;
}
