/**
 * Practice/Clinic Management System
 * Groups doctors and staff together in shared practices
 */

export interface Practice {
  id: string;
  name: string;
  type: 'solo' | 'group' | 'hospital' | 'clinic' | 'health_system';
  taxId?: string;
  npi?: string; // Group NPI

  // Practice Details
  address: {
    street: string;
    suite?: string;
    city: string;
    state: string;
    zip: string;
  };
  phone: string;
  fax?: string;
  email: string;
  website?: string;

  // Settings
  settings: {
    sharePatients: boolean; // Can all providers see all patients?
    requireApproval: boolean; // Require approval for new members?
    allowCrossScheduling: boolean; // Can providers schedule for each other?
    sharedTemplates: boolean; // Share note templates across practice?
    unifiedBilling: boolean; // Single billing entity?
  };

  // Subscription/Plan
  plan: 'starter' | 'professional' | 'enterprise';
  maxProviders: number;
  currentProviders: number;

  createdAt: Date;
  createdBy: string; // User ID who created the practice
  status: 'active' | 'suspended' | 'inactive';
}

export interface PracticeMember {
  id: string;
  userId: string;
  practiceId: string;

  // Member Info
  name: string;
  email: string;
  role:
    | 'doctor'
    | 'dietician'
    | 'psychiatrist'
    | 'nurse'
    | 'admin'
    | 'nutritionist'
    | 'medical_assistant'
    | 'front_office'
    | 'billing'
    | 'prior_auth';
  specialty?: string;
  department?: string;

  // Permissions within practice
  permissions: {
    isOwner: boolean; // Practice owner
    isAdmin: boolean; // Can manage practice settings
    canInvite: boolean; // Can invite new members
    canRemove: boolean; // Can remove members
    canViewAllPatients: boolean; // See all practice patients
    canEditAllPatients: boolean; // Edit all practice patients
    canManageBilling: boolean; // Access billing info
    canViewReports: boolean; // View practice analytics
  };

  // Status
  status: 'active' | 'invited' | 'suspended' | 'removed';
  joinedAt?: Date;
  invitedAt?: Date;
  invitedBy?: string;

  // Scheduling
  canBeScheduled: boolean;
  schedulingColor?: string; // For calendar display
  defaultAppointmentDuration?: number; // in minutes
}

export interface PracticeInvitation {
  id: string;
  practiceId: string;
  practiceName: string;

  // Invitation Details
  inviteeEmail: string;
  inviteeName?: string;
  role: PracticeMember['role'];

  // Invitation Metadata
  invitedBy: string;
  invitedByName: string;
  invitedAt: Date;
  expiresAt: Date;

  // Invitation Status
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  acceptedAt?: Date;
  declinedAt?: Date;

  // Access
  invitationCode: string; // Unique code for accepting
  invitationLink: string; // Direct link to join

  // Custom Message
  message?: string;
}

export interface PatientAccess {
  patientId: string;
  practiceId: string;

  // Primary Provider
  primaryProviderId: string;
  primaryProviderName: string;

  // Shared Access
  sharedWith: string[]; // Array of provider IDs who can access
  accessLevel: 'view' | 'edit' | 'full';

  // Care Team
  careTeam?: {
    providerId: string;
    providerName: string;
    role: string;
    since: Date;
  }[];

  // Access Log
  lastAccessedBy?: string;
  lastAccessedAt?: Date;
}

// Sample practices for demonstration
export const SAMPLE_PRACTICES: Practice[] = [
  {
    id: 'practice-001',
    name: 'TSHLA Endocrinology Associates',
    type: 'group',
    taxId: '12-3456789',
    npi: '1234567890',
    address: {
      street: '123 Medical Center Drive',
      suite: 'Suite 400',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    },
    phone: '(555) 123-4567',
    fax: '(555) 123-4568',
    email: 'info@tshla-endo.com',
    website: 'www.tshla-endo.com',
    settings: {
      sharePatients: true,
      requireApproval: true,
      allowCrossScheduling: true,
      sharedTemplates: true,
      unifiedBilling: true,
    },
    plan: 'professional',
    maxProviders: 15,
    currentProviders: 8,
    createdAt: new Date('2024-01-01'),
    createdBy: 'admin-001',
    status: 'active',
  },
  {
    id: 'practice-002',
    name: 'Westside Diabetes & Nutrition Center',
    type: 'clinic',
    address: {
      street: '456 Wellness Boulevard',
      city: 'Beverly Hills',
      state: 'CA',
      zip: '90210',
    },
    phone: '(555) 234-5678',
    email: 'contact@westside-diabetes.com',
    settings: {
      sharePatients: true,
      requireApproval: false,
      allowCrossScheduling: false,
      sharedTemplates: true,
      unifiedBilling: false,
    },
    plan: 'starter',
    maxProviders: 5,
    currentProviders: 3,
    createdAt: new Date('2024-03-15'),
    createdBy: 'doc-002',
    status: 'active',
  },
];

// Sample members
export const SAMPLE_MEMBERS: PracticeMember[] = [
  {
    id: 'member-001',
    userId: 'doc-001',
    practiceId: 'practice-001',
    name: 'Dr. Sarah Smith',
    email: 'dr.smith@tshla.ai',
    role: 'doctor',
    specialty: 'Endocrinology',
    permissions: {
      isOwner: true,
      isAdmin: true,
      canInvite: true,
      canRemove: true,
      canViewAllPatients: true,
      canEditAllPatients: true,
      canManageBilling: true,
      canViewReports: true,
    },
    status: 'active',
    joinedAt: new Date('2024-01-01'),
    canBeScheduled: true,
    schedulingColor: '#4F46E5',
    defaultAppointmentDuration: 30,
  },
  {
    id: 'member-002',
    userId: 'doc-002',
    practiceId: 'practice-001',
    name: 'Dr. Michael Jones',
    email: 'dr.jones@tshla.ai',
    role: 'doctor',
    specialty: 'Internal Medicine',
    permissions: {
      isOwner: false,
      isAdmin: false,
      canInvite: true,
      canRemove: false,
      canViewAllPatients: true,
      canEditAllPatients: true,
      canManageBilling: false,
      canViewReports: true,
    },
    status: 'active',
    joinedAt: new Date('2024-01-15'),
    canBeScheduled: true,
    schedulingColor: '#059669',
    defaultAppointmentDuration: 20,
  },
  {
    id: 'member-003',
    userId: 'diet-001',
    practiceId: 'practice-001',
    name: 'Emily Wilson, RD',
    email: 'emily.wilson@tshla.ai',
    role: 'dietician',
    specialty: 'Clinical Nutrition',
    permissions: {
      isOwner: false,
      isAdmin: false,
      canInvite: false,
      canRemove: false,
      canViewAllPatients: true,
      canEditAllPatients: false,
      canManageBilling: false,
      canViewReports: false,
    },
    status: 'active',
    joinedAt: new Date('2024-02-01'),
    canBeScheduled: true,
    schedulingColor: '#7C3AED',
    defaultAppointmentDuration: 45,
  },
];

/**
 * Helper function to format role names for display
 */
export function formatRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    doctor: 'Doctor',
    dietician: 'Dietician',
    psychiatrist: 'Psychiatrist',
    nurse: 'Nurse',
    nutritionist: 'Nutritionist',
    medical_assistant: 'Medical Assistant',
    front_office: 'Front Office',
    billing: 'Billing Specialist',
    prior_auth: 'Prior Authorization',
    admin: 'Administrator',
  };
  return roleNames[role] || role;
}

/**
 * Practice Management Functions
 */

export function getUserPractices(userId: string): Practice[] {
  // Get all practices where user is a member
  const userMemberships = SAMPLE_MEMBERS.filter(m => m.userId === userId);
  const practiceIds = userMemberships.map(m => m.practiceId);
  return SAMPLE_PRACTICES.filter(p => practiceIds.includes(p.id));
}

export function getPracticeMembers(practiceId: string): PracticeMember[] {
  return SAMPLE_MEMBERS.filter(m => m.practiceId === practiceId && m.status === 'active');
}

export function canUserAccessPatient(
  userId: string,
  patientId: string,
  practiceId: string
): boolean {
  const member = SAMPLE_MEMBERS.find(m => m.userId === userId && m.practiceId === practiceId);

  if (!member) return false;

  // Check if practice allows shared patients
  const practice = SAMPLE_PRACTICES.find(p => p.id === practiceId);
  if (practice?.settings.sharePatients && member.permissions.canViewAllPatients) {
    return true;
  }

  // Otherwise check specific patient access
  // This would check the PatientAccess table in a real implementation
  return false;
}

export function generateInvitationCode(): string {
  // Generate a unique 8-character code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createInvitationLink(practiceId: string, invitationCode: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join-practice?practice=${practiceId}&code=${invitationCode}`;
}

/**
 * Practice Types and Features
 */
export const PRACTICE_PLANS = {
  starter: {
    name: 'Starter',
    maxProviders: 5,
    features: ['Up to 5 providers', 'Basic patient sharing', 'Standard templates', 'Email support'],
    price: '$299/month',
  },
  professional: {
    name: 'Professional',
    maxProviders: 15,
    features: [
      'Up to 15 providers',
      'Advanced patient sharing',
      'Custom templates',
      'Cross-scheduling',
      'Analytics dashboard',
      'Priority support',
    ],
    price: '$799/month',
  },
  enterprise: {
    name: 'Enterprise',
    maxProviders: -1, // Unlimited
    features: [
      'Unlimited providers',
      'Multi-location support',
      'Custom workflows',
      'API access',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    price: 'Custom pricing',
  },
};

/**
 * Role Permissions Template
 */
export const DEFAULT_PERMISSIONS = {
  doctor: {
    isOwner: false,
    isAdmin: false,
    canInvite: true,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: true,
    canManageBilling: false,
    canViewReports: true,
  },
  dietician: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: false,
    canManageBilling: false,
    canViewReports: false,
  },
  psychiatrist: {
    isOwner: false,
    isAdmin: false,
    canInvite: true,
    canRemove: false,
    canViewAllPatients: false, // Privacy for mental health
    canEditAllPatients: false,
    canManageBilling: false,
    canViewReports: true,
  },
  nurse: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: false,
    canManageBilling: false,
    canViewReports: false,
  },
  admin: {
    isOwner: false,
    isAdmin: true,
    canInvite: true,
    canRemove: true,
    canViewAllPatients: false,
    canEditAllPatients: false,
    canManageBilling: true,
    canViewReports: true,
  },
  nutritionist: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: false,
    canManageBilling: false,
    canViewReports: false,
  },
  medical_assistant: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: true,
    canManageBilling: false,
    canViewReports: false,
  },
  front_office: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: false,
    canManageBilling: false,
    canViewReports: false,
  },
  billing: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: false,
    canManageBilling: true,
    canViewReports: true,
  },
  prior_auth: {
    isOwner: false,
    isAdmin: false,
    canInvite: false,
    canRemove: false,
    canViewAllPatients: true,
    canEditAllPatients: false,
    canManageBilling: false,
    canViewReports: false,
  },
};
