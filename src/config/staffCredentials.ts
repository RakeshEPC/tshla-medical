/**
 * Staff Configuration
 * SECURITY: Passwords are handled separately through secure authentication service
 * This only contains public profile information
 */

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: 'doctor' | 'admin' | 'nurse' | 'dietician' | 'psychiatrist';
  specialty?: string;
  department?: string;
}

export interface StaffCredential {
  email: string;
  passwordHash: string; // Bcrypt hashed password
  salt: string;
  lastLogin?: Date;
  isActive: boolean;
}

// Staff profiles (passwords handled separately through secure authentication)
export const STAFF_PROFILES: StaffMember[] = [
  // Existing doctors
  {
    id: 'doc-001',
    email: 'dr.smith@tshla.ai',
    name: 'Dr. Sarah Smith',
    role: 'doctor',
    specialty: 'Endocrinology',
  },
  {
    id: 'doc-002',
    email: 'dr.jones@tshla.ai',
    name: 'Dr. Michael Jones',
    role: 'doctor',
    specialty: 'Internal Medicine',
  },

  // Dieticians
  {
    id: 'diet-001',
    email: 'emily.wilson@tshla.ai',
    name: 'Emily Wilson, RD',
    role: 'dietician',
    specialty: 'Clinical Nutrition',
    department: 'Nutrition Services',
  },
  {
    id: 'diet-002',
    email: 'james.chen@tshla.ai',
    name: 'James Chen, RD',
    role: 'dietician',
    specialty: 'Diabetes Nutrition',
    department: 'Nutrition Services',
  },
  {
    id: 'diet-003',
    email: 'maria.garcia@tshla.ai',
    name: 'Maria Garcia, RD',
    role: 'dietician',
    specialty: 'Pediatric Nutrition',
    department: 'Nutrition Services',
  },

  // Psychiatrists
  {
    id: 'psych-001',
    email: 'dr.anderson@tshla.ai',
    name: 'Dr. Robert Anderson',
    role: 'psychiatrist',
    specialty: 'Adult Psychiatry',
    department: 'Behavioral Health',
  },
  {
    id: 'psych-002',
    email: 'dr.patel@tshla.ai',
    name: 'Dr. Priya Patel',
    role: 'psychiatrist',
    specialty: 'Child & Adolescent Psychiatry',
    department: 'Behavioral Health',
  },
  {
    id: 'psych-003',
    email: 'dr.williams@tshla.ai',
    name: 'Dr. Jennifer Williams',
    role: 'psychiatrist',
    specialty: 'Geriatric Psychiatry',
    department: 'Behavioral Health',
  },

  // Admin
  {
    id: 'admin-001',
    email: 'admin@tshla.ai',
    name: 'System Administrator',
    role: 'admin',
    department: 'IT',
  },

  // Nurses
  {
    id: 'nurse-001',
    email: 'nurse.johnson@tshla.ai',
    name: 'Linda Johnson, RN',
    role: 'nurse',
    department: 'General Care',
  },
];

// Helper function to get staff by email
export function getStaffByEmail(email: string): StaffMember | null {
  return STAFF_PROFILES.find(s => s.email.toLowerCase() === email.toLowerCase()) || null;
}

// Helper function to get all staff of a specific role
export function getStaffByRole(role: StaffMember['role']): StaffMember[] {
  return STAFF_PROFILES.filter(s => s.role === role);
}

// Helper function to get staff by ID
export function getStaffById(id: string): StaffMember | null {
  return STAFF_PROFILES.find(s => s.id === id) || null;
}

// Export staff summary for documentation (no passwords)
export const STAFF_SUMMARY = {
  dieticians: STAFF_PROFILES.filter(s => s.role === 'dietician'),
  psychiatrists: STAFF_PROFILES.filter(s => s.role === 'psychiatrist'),
  doctors: STAFF_PROFILES.filter(s => s.role === 'doctor'),
  admin: STAFF_PROFILES.filter(s => s.role === 'admin'),
  nurses: STAFF_PROFILES.filter(s => s.role === 'nurse'),
};

/**
 * NOTE: For authentication, use the secure authentication service
 * which handles password hashing, validation, and session management.
 * This file only contains public profile information.
 */
