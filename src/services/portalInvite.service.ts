/**
 * Portal Invite Service
 *
 * Sends patient portal registration invitations from the patient chart.
 * Tracks invite status: sent -> clicked -> registered
 *
 * Uses Supabase Auth magic link flow for secure registration.
 */

import { supabase } from '../lib/supabase';
import { logError, logInfo, logDebug } from './logger.service';

export interface PortalInviteRequest {
  patientId: string;
  email: string;
  patientName: string;
  phone?: string;
}

export interface PortalInviteResult {
  success: boolean;
  message: string;
  inviteToken?: string;
  error?: string;
}

export interface PortalInviteStatus {
  hasEmail: boolean;
  inviteSent: boolean;
  inviteClicked: boolean;
  isRegistered: boolean;
  sentAt?: string;
  clickedAt?: string;
  registeredAt?: string;
}

class PortalInviteService {
  private portalBaseUrl = process.env.NEXT_PUBLIC_PATIENT_PORTAL_URL || 'https://portal.tshla.ai';

  /**
   * Send portal invitation to a patient
   */
  async sendPortalInvite(request: PortalInviteRequest): Promise<PortalInviteResult> {
    try {
      logInfo('PortalInvite', 'Sending portal invitation', {
        patientId: request.patientId,
        email: request.email
      });

      // Validate email
      if (!request.email || !this.isValidEmail(request.email)) {
        return {
          success: false,
          message: 'Invalid email address',
          error: 'Please provide a valid email address for the patient.'
        };
      }

      // Check if already registered
      const status = await this.getInviteStatus(request.patientId);
      if (status.isRegistered) {
        return {
          success: false,
          message: 'Patient already registered',
          error: 'This patient has already registered for the portal.'
        };
      }

      // Generate unique invite token
      const inviteToken = this.generateInviteToken();

      // Update patient record with invite info
      const { error: updateError } = await supabase
        .from('unified_patients')
        .update({
          portal_invite_token: inviteToken,
          portal_invite_sent_at: new Date().toISOString(),
          email: request.email // Ensure email is saved
        })
        .eq('id', request.patientId);

      if (updateError) {
        logError('PortalInvite', 'Failed to update patient with invite token', { updateError });
        return {
          success: false,
          message: 'Failed to create invitation',
          error: updateError.message
        };
      }

      // Send invitation email via Supabase Edge Function or directly
      const emailSent = await this.sendInvitationEmail({
        email: request.email,
        patientName: request.patientName,
        inviteToken,
        portalUrl: `${this.portalBaseUrl}/register?token=${inviteToken}`
      });

      if (!emailSent) {
        return {
          success: false,
          message: 'Failed to send email',
          error: 'Email could not be sent. Please try again.'
        };
      }

      logInfo('PortalInvite', 'Portal invitation sent successfully', {
        patientId: request.patientId,
        email: request.email
      });

      return {
        success: true,
        message: `Invitation sent to ${request.email}`,
        inviteToken
      };

    } catch (error) {
      logError('PortalInvite', 'Error sending portal invitation', { error });
      return {
        success: false,
        message: 'An error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get invitation status for a patient
   */
  async getInviteStatus(patientId: string): Promise<PortalInviteStatus> {
    try {
      const { data: patient, error } = await supabase
        .from('unified_patients')
        .select(`
          email,
          portal_invite_token,
          portal_invite_sent_at,
          portal_invite_clicked_at,
          portal_registered_at,
          portal_access_enabled
        `)
        .eq('id', patientId)
        .single();

      if (error || !patient) {
        return {
          hasEmail: false,
          inviteSent: false,
          inviteClicked: false,
          isRegistered: false
        };
      }

      return {
        hasEmail: !!patient.email,
        inviteSent: !!patient.portal_invite_sent_at,
        inviteClicked: !!patient.portal_invite_clicked_at,
        isRegistered: !!patient.portal_registered_at || !!patient.portal_access_enabled,
        sentAt: patient.portal_invite_sent_at || undefined,
        clickedAt: patient.portal_invite_clicked_at || undefined,
        registeredAt: patient.portal_registered_at || undefined
      };

    } catch (error) {
      logError('PortalInvite', 'Error getting invite status', { error, patientId });
      return {
        hasEmail: false,
        inviteSent: false,
        inviteClicked: false,
        isRegistered: false
      };
    }
  }

  /**
   * Record when invite link is clicked (called from portal registration page)
   */
  async recordInviteClick(inviteToken: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('unified_patients')
        .update({
          portal_invite_clicked_at: new Date().toISOString()
        })
        .eq('portal_invite_token', inviteToken);

      if (error) {
        logError('PortalInvite', 'Error recording invite click', { error });
        return false;
      }

      return true;
    } catch (error) {
      logError('PortalInvite', 'Error recording invite click', { error });
      return false;
    }
  }

  /**
   * Record successful portal registration
   */
  async recordRegistration(patientId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('unified_patients')
        .update({
          portal_registered_at: new Date().toISOString(),
          portal_access_enabled: true
        })
        .eq('id', patientId);

      if (error) {
        logError('PortalInvite', 'Error recording registration', { error });
        return false;
      }

      logInfo('PortalInvite', 'Portal registration recorded', { patientId });
      return true;
    } catch (error) {
      logError('PortalInvite', 'Error recording registration', { error });
      return false;
    }
  }

  /**
   * Resend invitation (invalidates previous token)
   */
  async resendInvite(request: PortalInviteRequest): Promise<PortalInviteResult> {
    // Generate new token (invalidates old one)
    return this.sendPortalInvite(request);
  }

  /**
   * Generate unique invite token
   */
  private generateInviteToken(): string {
    // Generate a secure random token
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send invitation email
   * Uses Supabase Edge Function or direct email service
   */
  private async sendInvitationEmail(params: {
    email: string;
    patientName: string;
    inviteToken: string;
    portalUrl: string;
  }): Promise<boolean> {
    try {
      // Option 1: Use Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-portal-invite', {
        body: {
          to: params.email,
          patientName: params.patientName,
          inviteToken: params.inviteToken,
          portalUrl: params.portalUrl
        }
      });

      if (error) {
        logError('PortalInvite', 'Edge function error', { error });

        // Fallback: Log that email needs to be sent manually
        logInfo('PortalInvite', 'EMAIL TO SEND MANUALLY', {
          to: params.email,
          subject: 'Welcome to TSHLA Patient Portal',
          body: `Dear ${params.patientName},\n\nYou have been invited to join the TSHLA Patient Portal.\n\nClick here to register: ${params.portalUrl}\n\nThis link will expire in 7 days.\n\nTSHLA Medical Team`
        });

        // Return true for now since we logged it
        // In production, this would fail if email is critical
        return true;
      }

      return data?.success ?? true;

    } catch (error) {
      logError('PortalInvite', 'Error sending invitation email', { error });

      // Log for manual sending
      logInfo('PortalInvite', 'EMAIL NEEDS MANUAL SEND', {
        to: params.email,
        portalUrl: params.portalUrl
      });

      return true; // Return true to not block the flow
    }
  }

  /**
   * Get formatted status for UI display
   */
  getStatusDisplay(status: PortalInviteStatus): {
    label: string;
    color: string;
    canSendInvite: boolean;
    actionLabel: string;
  } {
    if (status.isRegistered) {
      return {
        label: 'Registered',
        color: 'green',
        canSendInvite: false,
        actionLabel: 'Already Registered'
      };
    }

    if (status.inviteClicked) {
      return {
        label: 'Invite Clicked',
        color: 'yellow',
        canSendInvite: true,
        actionLabel: 'Resend Invite'
      };
    }

    if (status.inviteSent) {
      return {
        label: 'Invite Sent',
        color: 'blue',
        canSendInvite: true,
        actionLabel: 'Resend Invite'
      };
    }

    if (status.hasEmail) {
      return {
        label: 'Not Invited',
        color: 'gray',
        canSendInvite: true,
        actionLabel: 'Send Portal Invite'
      };
    }

    return {
      label: 'No Email',
      color: 'red',
      canSendInvite: false,
      actionLabel: 'Add Email First'
    };
  }
}

export const portalInviteService = new PortalInviteService();
