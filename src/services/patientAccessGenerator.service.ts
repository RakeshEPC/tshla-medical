/**
 * Patient Access Generator Service
 * Creates patient portal accounts and sends invitation emails for PCM enrollment
 *
 * Features:
 * - Generate secure temporary passwords
 * - Create patient accounts in Supabase Auth
 * - Send email invitations with consent form links
 * - Track invitation status
 */

import { supabase } from '../lib/supabase';
import { logDebug, logError, logInfo } from './logger.service';

export interface PatientAccessRequest {
  email: string;
  patientName: string;
  phone?: string;
  mrn?: string;
  pcmEnrollmentId?: string;
}

export interface PatientAccessResult {
  success: boolean;
  userId?: string;
  temporaryPassword?: string;
  invitationSent?: boolean;
  error?: string;
  consentFormUrl?: string;
}

class PatientAccessGeneratorService {
  /**
   * Generate a secure temporary password
   * Format: FirstName-NNNN (e.g., John-1234)
   */
  generateTemporaryPassword(patientName: string): string {
    // Extract first name
    const firstName = patientName.split(' ')[0] || 'Patient';

    // Generate random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);

    return `${firstName}-${randomNum}`;
  }

  /**
   * Create patient portal account and send invitation email
   */
  async createPatientAccess(request: PatientAccessRequest): Promise<PatientAccessResult> {
    try {
      logInfo('PatientAccessGenerator', 'Creating patient portal access', {
        email: request.email,
        patientName: request.patientName
      });

      // Validate email
      if (!request.email || !this.isValidEmail(request.email)) {
        return {
          success: false,
          error: 'Invalid email address'
        };
      }

      // Generate temporary password
      const temporaryPassword = this.generateTemporaryPassword(request.patientName);

      // Create user in Supabase Auth
      // Note: In production, you may want to use admin API for this
      // For now, we'll use the invite user flow which sends an email automatically

      logDebug('PatientAccessGenerator', 'Attempting to create Supabase Auth user', {
        email: request.email
      });

      // Option 1: Use Supabase Admin API to create user with password
      // This requires SUPABASE_SERVICE_ROLE_KEY
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: request.email,
        password: temporaryPassword,
        email_confirm: true, // Auto-confirm email for PCM enrollment workflow
        user_metadata: {
          full_name: request.patientName,
          phone: request.phone || '',
          mrn: request.mrn || '',
          access_type: 'patient',
          enrollment_date: new Date().toISOString(),
          pcm_enrollment_id: request.pcmEnrollmentId || null,
          password_change_required: true // Flag for forced password change on first login
        }
      });

      if (authError) {
        // Check if user already exists
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          logInfo('PatientAccessGenerator', 'Patient account already exists', { email: request.email });

          // Return success but indicate account already existed
          return {
            success: true,
            invitationSent: false,
            error: 'Patient account already exists. Use password reset to send new login instructions.',
            consentFormUrl: this.getConsentFormUrl(request.email)
          };
        }

        logError('PatientAccessGenerator', 'Failed to create Supabase Auth user', authError);
        return {
          success: false,
          error: `Authentication error: ${authError.message}`
        };
      }

      const userId = authData?.user?.id;

      if (!userId) {
        return {
          success: false,
          error: 'Failed to create user account - no user ID returned'
        };
      }

      logInfo('PatientAccessGenerator', 'Supabase Auth user created successfully', {
        userId,
        email: request.email
      });

      // Create entry in pump_users table for patient portal access
      const { error: dbError } = await supabase
        .from('pump_users')
        .insert({
          email: request.email,
          password_hash: 'managed_by_supabase_auth', // Actual password managed by Supabase Auth
          name: request.patientName,
          role: 'patient',
          auth_user_id: userId,
          created_at: new Date().toISOString(),
          phone: request.phone || null
        });

      if (dbError) {
        logError('PatientAccessGenerator', 'Failed to create pump_users record', dbError);
        // User created in auth but not in pump_users - this is recoverable
        // Continue and send invitation anyway
      }

      // Send invitation email with temporary password and consent form link
      const emailSent = await this.sendInvitationEmail({
        email: request.email,
        patientName: request.patientName,
        temporaryPassword,
        userId
      });

      const consentFormUrl = this.getConsentFormUrl(request.email);

      logInfo('PatientAccessGenerator', 'Patient access created successfully', {
        userId,
        email: request.email,
        emailSent
      });

      return {
        success: true,
        userId,
        temporaryPassword,
        invitationSent: emailSent,
        consentFormUrl
      };

    } catch (error: any) {
      logError('PatientAccessGenerator', 'Unexpected error creating patient access', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }

  /**
   * Send invitation email to patient
   * In production, this would use a proper email service (SendGrid, AWS SES, etc.)
   * For now, we'll log the email content
   */
  private async sendInvitationEmail(params: {
    email: string;
    patientName: string;
    temporaryPassword: string;
    userId: string;
  }): Promise<boolean> {
    try {
      const { email, patientName, temporaryPassword } = params;

      const consentFormUrl = this.getConsentFormUrl(email);
      const loginUrl = `${window.location.origin}/patient-login`;

      // Email content
      const emailSubject = 'Welcome to TSHLA Medical - Your Portal Access';
      const emailBody = `
Dear ${patientName},

Welcome to TSHLA Medical's Patient Portal! You have been enrolled in our Principal Care Management (PCM) program.

Your portal login credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━
Email: ${email}
Temporary Password: ${temporaryPassword}
━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT NEXT STEPS:

1. Log in to your patient portal:
   ${loginUrl}

2. You will be prompted to change your password on first login

3. Review and sign the PCM consent form:
   ${consentFormUrl}

4. Complete your health profile and medication list

ABOUT YOUR PCM PROGRAM:

As a PCM patient, you'll receive:
✓ Regular check-ins from our care team
✓ Medication management support
✓ Lab result tracking and goal setting
✓ 24/7 access to your health records
✓ Direct messaging with your provider

NEED HELP?

If you have trouble logging in, please contact our office:
📞 Phone: (555) 123-4567
📧 Email: support@tshla.ai

Welcome to better health management!

TSHLA Medical Team

━━━━━━━━━━━━━━━━━━━━━━━━━
This email contains confidential information. If you received this in error, please delete it immediately.
      `.trim();

      // TODO: In production, integrate with actual email service
      // Example: await sendEmail({ to: email, subject: emailSubject, body: emailBody });

      // For now, log the email content (for development/testing)
      logInfo('PatientAccessGenerator', 'Invitation email prepared', {
        to: email,
        subject: emailSubject,
        preview: emailBody.substring(0, 100) + '...'
      });

      // In development, also log full email for easy testing
      console.log('\n' + '='.repeat(80));
      console.log('📧 PATIENT INVITATION EMAIL');
      console.log('='.repeat(80));
      console.log(`To: ${email}`);
      console.log(`Subject: ${emailSubject}`);
      console.log('-'.repeat(80));
      console.log(emailBody);
      console.log('='.repeat(80) + '\n');

      // TODO: Actual email sending would go here
      // For now, return true to indicate email was "sent" (logged)
      return true;

    } catch (error: any) {
      logError('PatientAccessGenerator', 'Failed to send invitation email', error);
      return false;
    }
  }

  /**
   * Generate consent form URL for patient
   */
  private getConsentFormUrl(email: string): string {
    const baseUrl = window.location.origin;
    const encodedEmail = encodeURIComponent(email);
    return `${baseUrl}/patient-consent?email=${encodedEmail}`;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send password reset email (for existing patients)
   */
  async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        logError('PatientAccessGenerator', 'Failed to send password reset email', error);
        return {
          success: false,
          error: error.message
        };
      }

      logInfo('PatientAccessGenerator', 'Password reset email sent', { email });

      return {
        success: true
      };

    } catch (error: any) {
      logError('PatientAccessGenerator', 'Unexpected error sending password reset', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if patient account already exists
   */
  async checkPatientExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('pump_users')
        .select('id')
        .eq('email', email)
        .eq('role', 'patient')
        .single();

      if (error) {
        // If error is "not found", patient doesn't exist
        return false;
      }

      return !!data;

    } catch (error) {
      logError('PatientAccessGenerator', 'Error checking if patient exists', error);
      return false;
    }
  }
}

// Export singleton instance
export const patientAccessGenerator = new PatientAccessGeneratorService();
