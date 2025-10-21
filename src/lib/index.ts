// Central exports for all backend functionality
// Security and Authentication
export * from './auth/authService';
export * from './auth/jwtSession';
export * from './auth/session';
export * from './auth/sessionManager';
export * from './security/authentication';
export * from './security/encryption';
export * from './security/sessionManager';
export * from './hipaa-auth';
export * from './secure-session';

// Database
export * from './db/client';
export * from './db/config';
export * from './db/migrate';

// API and Services
export * from './api';
export * from './api/medical-api';
export * from './api/securePatientApi';
export * from './services/securePatientService';

// Audit and Compliance
export * from './audit-logger';
export * from './audit/auditLogger';
export * from './audit/auditTrail';
export * from './security/auditLog';

// Encryption and Security Storage
export * from './encryption';
export * from './crypto/patientEncryption';
export * from './security/secureStorage';
export * from './security/pumpSecureStorage';
export * from './security/clientSecureStorage';

// Templates and Storage
// templateStorage has been removed - use doctorProfileService instead
export type { Template } from '../types/template.types';
export { default as templateStore } from './templateStore';
export * from './templates/defaultTemplates';
export * from './soapTemplates';

// Prior Authorization
export * from './priorAuth/clinicalDataExtractor';
export * from './priorAuth/medicationDatabase';
export * from './priorAuth/medicationQuestions';
export * from './priorAuth/paValidator';

// Azure and External Services
export * from './azure-speech-config';
export * from './azureBlob';
export * from './azureBlobJson';
export * from './speech/enhancedRecognition';

// Utilities
export * from './endpoints';
export * from './audio-config';
export * from './pump-dimensions';
export * from './schedule-storage';
export * from './outbox';
export * from './who';
export * from './userPreferences';
export * from './testPatients';
export * from './useApiHealth';
export * from './compat';

// Supabase
export * from './supabase/client';
export * from './supabase/previsit-service';
