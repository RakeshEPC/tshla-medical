/**
 * Validation Schemas
 *
 * Zod schemas for validating user input across the application.
 * Part of HIPAA Phase 9: Input Validation & Sanitization
 *
 * HIPAA Compliance: §164.312(c)(1) - Integrity Controls
 */

import { z } from 'zod';

// =====================================================
// Common Validation Patterns
// =====================================================

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^\+?1?\d{10,15}$/;
const nameRegex = /^[a-zA-Z\s'-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const mrnRegex = /^[A-Z0-9-]{6,20}$/;

// =====================================================
// Patient Schemas
// =====================================================

export const patientSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be 50 characters or less')
    .regex(nameRegex, 'First name can only contain letters, spaces, hyphens, and apostrophes'),

  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be 50 characters or less')
    .regex(nameRegex, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),

  email: z
    .string()
    .email('Invalid email address')
    .regex(emailRegex, 'Invalid email format')
    .max(100, 'Email must be 100 characters or less'),

  phone: z
    .string()
    .regex(phoneRegex, 'Invalid phone number format (must be 10-15 digits)')
    .optional(),

  date_of_birth: z
    .string()
    .regex(dateRegex, 'Date of birth must be in YYYY-MM-DD format')
    .refine((date) => {
      const d = new Date(date);
      const now = new Date();
      const age = now.getFullYear() - d.getFullYear();
      return age >= 0 && age <= 120;
    }, 'Date of birth must be reasonable (0-120 years ago)'),

  mrn: z
    .string()
    .regex(mrnRegex, 'MRN must be 6-20 alphanumeric characters')
    .optional(),

  ava_id: z
    .string()
    .optional(),

  address: z
    .string()
    .max(200, 'Address must be 200 characters or less')
    .optional(),

  city: z
    .string()
    .max(100, 'City must be 100 characters or less')
    .optional(),

  state: z
    .string()
    .length(2, 'State must be 2 characters')
    .regex(/^[A-Z]{2}$/, 'State must be 2 uppercase letters')
    .optional(),

  zip_code: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
    .optional()
});

export type PatientInput = z.infer<typeof patientSchema>;

// =====================================================
// Medical Staff Schemas
// =====================================================

export const medicalStaffSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .regex(emailRegex, 'Invalid email format')
    .max(100, 'Email must be 100 characters or less'),

  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),

  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be 50 characters or less')
    .regex(nameRegex, 'First name can only contain letters, spaces, hyphens, and apostrophes'),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be 50 characters or less')
    .regex(nameRegex, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),

  role: z.enum(['doctor', 'nurse', 'staff', 'admin', 'super_admin']),

  specialty: z
    .string()
    .max(100, 'Specialty must be 100 characters or less')
    .optional(),

  practice: z
    .string()
    .max(100, 'Practice name must be 100 characters or less')
    .optional()
});

export type MedicalStaffInput = z.infer<typeof medicalStaffSchema>;

// =====================================================
// Pump Report Schemas
// =====================================================

export const pumpReportSchema = z.object({
  patient_id: z
    .string()
    .uuid('Invalid patient ID format'),

  report_date: z
    .string()
    .regex(dateRegex, 'Report date must be in YYYY-MM-DD format'),

  blood_sugar_avg: z
    .number()
    .min(0, 'Blood sugar cannot be negative')
    .max(1000, 'Blood sugar value seems unreasonably high'),

  insulin_dose_total: z
    .number()
    .min(0, 'Insulin dose cannot be negative')
    .max(500, 'Insulin dose seems unreasonably high'),

  time_in_range_percentage: z
    .number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100'),

  hypoglycemia_events: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),

  hyperglycemia_events: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),

  notes: z
    .string()
    .max(5000, 'Notes must be 5000 characters or less')
    .optional()
});

export type PumpReportInput = z.infer<typeof pumpReportSchema>;

// =====================================================
// Appointment Schemas
// =====================================================

export const appointmentSchema = z.object({
  patient_id: z
    .string()
    .uuid('Invalid patient ID format'),

  provider_id: z
    .string()
    .uuid('Invalid provider ID format'),

  appointment_date: z
    .string()
    .regex(dateRegex, 'Appointment date must be in YYYY-MM-DD format'),

  appointment_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)'),

  duration_minutes: z
    .number()
    .int('Duration must be whole minutes')
    .min(5, 'Appointment must be at least 5 minutes')
    .max(480, 'Appointment cannot exceed 8 hours'),

  appointment_type: z
    .string()
    .max(100, 'Appointment type must be 100 characters or less'),

  notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .optional()
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

// =====================================================
// Medical Dictation / Notes Schemas
// =====================================================

export const medicalNoteSchema = z.object({
  patient_id: z
    .string()
    .uuid('Invalid patient ID format'),

  provider_id: z
    .string()
    .uuid('Invalid provider ID format'),

  note_type: z.enum(['SOAP', 'Progress', 'Consultation', 'Discharge', 'Other']),

  chief_complaint: z
    .string()
    .max(500, 'Chief complaint must be 500 characters or less')
    .optional(),

  subjective: z
    .string()
    .max(10000, 'Subjective section must be 10000 characters or less')
    .optional(),

  objective: z
    .string()
    .max(10000, 'Objective section must be 10000 characters or less')
    .optional(),

  assessment: z
    .string()
    .max(10000, 'Assessment section must be 10000 characters or less')
    .optional(),

  plan: z
    .string()
    .max(10000, 'Plan section must be 10000 characters or less')
    .optional(),

  full_note: z
    .string()
    .max(50000, 'Note must be 50000 characters or less')
});

export type MedicalNoteInput = z.infer<typeof medicalNoteSchema>;

// =====================================================
// Search / Query Schemas
// =====================================================

export const patientSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(100, 'Search query must be 100 characters or less')
    .regex(/^[a-zA-Z0-9\s'-@.]+$/, 'Search query contains invalid characters'),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
});

export type PatientSearchInput = z.infer<typeof patientSearchSchema>;

// =====================================================
// Date Range Schemas
// =====================================================

export const dateRangeSchema = z.object({
  start_date: z
    .string()
    .regex(dateRegex, 'Start date must be in YYYY-MM-DD format'),

  end_date: z
    .string()
    .regex(dateRegex, 'End date must be in YYYY-MM-DD format')
}).refine((data) => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return start <= end;
}, {
  message: 'End date must be after or equal to start date'
});

export type DateRangeInput = z.infer<typeof dateRangeSchema>;

// =====================================================
// Helper Functions
// =====================================================

/**
 * Validate data against a schema and return typed errors
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with { success, data, errors }
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T; errors: null } | { success: false; data: null; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data, errors: null };
  }

  // Convert Zod errors to a more friendly format
  const errors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return { success: false, data: null, errors };
}

/**
 * Validate data and throw error if invalid
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws Error with validation message if invalid
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);

  if (!result.success) {
    const errorMessages = Object.entries(result.errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');

    throw new Error(`Validation failed: ${errorMessages}`);
  }

  return result.data;
}
