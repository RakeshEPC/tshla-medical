/**
 * PCM (Principal Care Management) Type Definitions
 */

export interface PCMConsentData {
  signature: string;
  agreedToTerms: boolean;
  agreedToBilling: boolean;
  agreedToPrivacy: boolean;
  consentDate: string;
  initialA1C?: number;
  initialBloodPressure?: string;
  initialWeight?: number;
  targetA1C?: number;
  targetBloodPressure?: string;
  targetWeight?: number;
}
