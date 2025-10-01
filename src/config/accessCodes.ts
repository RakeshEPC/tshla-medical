/**
 * Simplified Access Code System
 * Makes it easy to share access with new doctors and staff
 */

export interface AccessCode {
  code: string;
  role: 'doctor' | 'dietician' | 'psychiatrist' | 'nurse' | 'admin';
  name?: string;
  specialty?: string;
  expiresAt?: Date;
  maxUses?: number;
  currentUses?: number;
}

/**
 * Simple access codes that can be shared easily
 * Format: ROLE-XXXX (easy to remember and share)
 */
export const ACCESS_CODES: AccessCode[] = [
  // Universal codes for each role
  {
    code: 'DOCTOR-2025',
    role: 'doctor',
    name: 'Guest Doctor',
    specialty: 'General Medicine',
  },
  {
    code: 'DIET-2025',
    role: 'dietician',
    name: 'Guest Dietician',
    specialty: 'Clinical Nutrition',
  },
  {
    code: 'PSYCH-2025',
    role: 'psychiatrist',
    name: 'Guest Psychiatrist',
    specialty: 'General Psychiatry',
  },
  {
    code: 'NURSE-2025',
    role: 'nurse',
    name: 'Guest Nurse',
  },

  // Specialty-specific codes
  {
    code: 'ENDO-2025',
    role: 'doctor',
    name: 'Guest Endocrinologist',
    specialty: 'Endocrinology',
  },
  {
    code: 'DIABETES-2025',
    role: 'dietician',
    name: 'Guest Diabetes Educator',
    specialty: 'Diabetes Management',
  },

  // Demo/Testing codes
  {
    code: 'DEMO',
    role: 'doctor',
    name: 'Demo Doctor',
    specialty: 'Demo Account',
  },
  {
    code: 'TEST',
    role: 'doctor',
    name: 'Test Doctor',
    specialty: 'Testing',
  },
];

/**
 * Validate an access code
 */
export function validateAccessCode(code: string): AccessCode | null {
  const upperCode = code.toUpperCase().trim();
  const accessCode = ACCESS_CODES.find(ac => ac.code === upperCode);

  if (!accessCode) {
    return null;
  }

  // Check if expired
  if (accessCode.expiresAt && new Date() > accessCode.expiresAt) {
    return null;
  }

  // Check usage limits
  if (
    accessCode.maxUses &&
    accessCode.currentUses &&
    accessCode.currentUses >= accessCode.maxUses
  ) {
    return null;
  }

  return accessCode;
}

/**
 * Generate a personalized access code
 */
export function generatePersonalAccessCode(
  name: string,
  role: 'doctor' | 'dietician' | 'psychiatrist' | 'nurse',
  specialty?: string
): string {
  // Generate a simple 4-digit code
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const rolePrefix = role.substring(0, 3).toUpperCase();
  return `${rolePrefix}-${randomNum}`;
}

/**
 * Quick access for demonstrations
 */
export const DEMO_ACCOUNTS = [
  {
    label: '👨‍⚕️ Demo Doctor',
    code: 'DEMO',
    description: 'Full access to medical features',
  },
  {
    label: '🥗 Demo Dietician',
    code: 'DIET-2025',
    description: 'Nutrition and meal planning tools',
  },
  {
    label: '🧠 Demo Psychiatrist',
    code: 'PSYCH-2025',
    description: 'Mental health assessment tools',
  },
  {
    label: '👩‍⚕️ Demo Nurse',
    code: 'NURSE-2025',
    description: 'Patient care and vitals tracking',
  },
];

/**
 * Shareable onboarding links
 */
export function generateOnboardingLink(
  code: string,
  baseUrl: string = 'https://www.tshla.ai'
): string {
  return `${baseUrl}/login?access=${code}`;
}

/**
 * Instructions for sharing
 */
export const SHARING_INSTRUCTIONS = `
To give a new doctor access to TSHLA Medical:

1. Share this access code: DOCTOR-2025
2. Or send this link: https://www.tshla.ai/login?access=DOCTOR-2025
3. They can login immediately - no password needed!

For specific roles:
• Dieticians: DIET-2025
• Psychiatrists: PSYCH-2025
• Nurses: NURSE-2025
• Endocrinologists: ENDO-2025

For demos/testing:
• Use code: DEMO
• Or click "Try Demo" on login page
`;
