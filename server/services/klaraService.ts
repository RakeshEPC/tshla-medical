/**
 * Klara Service
 * Handles HIPAA-compliant text notifications via Klara platform
 * Created: January 2025
 */

import { createClient } from '@supabase/supabase-js';

// Supabase client for logging
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Klara API configuration
const KLARA_API_KEY = process.env.KLARA_API_KEY;
const KLARA_ORG_ID = process.env.KLARA_ORG_ID;
const KLARA_API_URL = 'https://api.klara.com/v2/messages'; // Update with actual Klara API endpoint

// =====================================================
// INTERFACES
// =====================================================

export interface KlaraNotificationOptions {
  patientId: string; // UUID
  patientPhone: string;
  patientName: string;
  message: string;
  appointmentId?: string;
  providerName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}

export interface KlaraResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =====================================================
// MESSAGE TEMPLATES
// =====================================================

/**
 * Generate pre-visit notification message (Day -3)
 */
export function generatePreVisitNotificationMessage(options: {
  patientName: string;
  providerName: string;
  appointmentDate: string;
  appointmentTime: string;
}): string {
  const dateFormatted = new Date(options.appointmentDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return `Hi ${options.patientName}, you have an appointment with Dr. ${options.providerName} on ${dateFormatted} at ${options.appointmentTime}. Tomorrow you'll receive an automated call to help prepare for your visit. Please answer - it only takes 3-5 minutes! - TSHLA Medical`;
}

/**
 * Generate appointment reminder message
 */
export function generateAppointmentReminderMessage(options: {
  patientName: string;
  providerName: string;
  appointmentDate: string;
  appointmentTime: string;
}): string {
  const dateFormatted = new Date(options.appointmentDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return `Reminder: ${options.patientName}, your appointment with Dr. ${options.providerName} is on ${dateFormatted} at ${options.appointmentTime}. Please bring your insurance card and photo ID. - TSHLA Medical`;
}

/**
 * Generate urgent callback message
 */
export function generateUrgentCallbackMessage(options: {
  patientName: string;
  providerName: string;
}): string {
  return `${options.patientName}, Dr. ${options.providerName} needs to speak with you urgently. Please call our office immediately at [OFFICE_PHONE]. - TSHLA Medical`;
}

// =====================================================
// KLARA API INTEGRATION
// =====================================================

/**
 * Send notification via Klara
 */
export async function sendKlaraNotification(
  options: KlaraNotificationOptions
): Promise<KlaraResult> {
  console.log('\n📱 Sending Klara notification...');
  console.log(`   To: ${options.patientName} (${options.patientPhone})`);
  console.log(`   Message: ${options.message.substring(0, 50)}...`);

  // Validate configuration
  if (!KLARA_API_KEY || !KLARA_ORG_ID) {
    const error = 'Klara API credentials not configured. Set KLARA_API_KEY and KLARA_ORG_ID';
    console.warn('⚠️', error);

    // Log failed notification
    await logNotification({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      notificationType: 'klara-text',
      status: 'failed',
      messageContent: options.message,
      error,
    });

    return { success: false, error };
  }

  try {
    // Call Klara API
    // Note: This is a placeholder - actual Klara API may differ
    // Check Klara documentation for exact endpoint and payload structure
    const response = await fetch(KLARA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KLARA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization_id: KLARA_ORG_ID,
        recipient_phone: options.patientPhone,
        recipient_name: options.patientName,
        message_text: options.message,
        message_type: 'appointment_reminder',
        // Add any other required Klara fields
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Klara API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const messageId = data.message_id || data.id;

    console.log(`✅ Klara notification sent. Message ID: ${messageId}`);

    // Log successful notification
    await logNotification({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      notificationType: 'klara-text',
      status: 'sent',
      messageContent: options.message,
      klaraMessageId: messageId,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    console.error('❌ Failed to send Klara notification:', error);

    // Log failed notification
    await logNotification({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      notificationType: 'klara-text',
      status: 'failed',
      messageContent: options.message,
      error: error.message,
    });

    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Send pre-visit notification (Day -3)
 */
export async function sendPreVisitNotification(options: {
  patientId: string;
  patientPhone: string;
  patientName: string;
  appointmentId?: string;
  providerName: string;
  appointmentDate: string;
  appointmentTime: string;
}): Promise<KlaraResult> {
  const message = generatePreVisitNotificationMessage({
    patientName: options.patientName,
    providerName: options.providerName,
    appointmentDate: options.appointmentDate,
    appointmentTime: options.appointmentTime,
  });

  return sendKlaraNotification({
    patientId: options.patientId,
    patientPhone: options.patientPhone,
    patientName: options.patientName,
    appointmentId: options.appointmentId,
    message,
    providerName: options.providerName,
    appointmentDate: options.appointmentDate,
    appointmentTime: options.appointmentTime,
  });
}

// =====================================================
// DATABASE LOGGING
// =====================================================

/**
 * Log notification to database
 */
async function logNotification(data: {
  patientId: string;
  appointmentId?: string;
  notificationType: string;
  status: string;
  messageContent: string;
  klaraMessageId?: string;
  error?: string;
}): Promise<void> {
  try {
    await supabase.from('previsit_notification_log').insert({
      patient_id: data.patientId,
      appointment_id: data.appointmentId || null,
      notification_type: data.notificationType,
      notification_status: data.status,
      message_content: data.messageContent,
      klara_message_id: data.klaraMessageId || null,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log notification:', error);
  }
}

/**
 * Update notification delivery status
 */
export async function updateNotificationStatus(
  klaraMessageId: string,
  status: 'delivered' | 'read' | 'failed'
): Promise<void> {
  try {
    const updateData: any = {
      notification_status: status,
    };

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'read') {
      updateData.read_at = new Date().toISOString();
    }

    await supabase
      .from('previsit_notification_log')
      .update(updateData)
      .eq('klara_message_id', klaraMessageId);
  } catch (error) {
    console.error('Failed to update notification status:', error);
  }
}

// =====================================================
// FALLBACK: SMS VIA TWILIO (if Klara unavailable)
// =====================================================

/**
 * Send SMS via Twilio as fallback
 * Use this if Klara is not configured or fails
 */
export async function sendSMSFallback(options: {
  patientPhone: string;
  message: string;
}): Promise<KlaraResult> {
  console.log('⚠️ Using Twilio SMS fallback (Klara not available)');

  try {
    // This requires Twilio to be installed and configured
    const twilio = require('twilio');
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const messageResult = await twilioClient.messages.create({
      to: options.patientPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: options.message,
    });

    console.log(`✅ SMS sent via Twilio. SID: ${messageResult.sid}`);

    return {
      success: true,
      messageId: messageResult.sid,
    };
  } catch (error: any) {
    console.error('❌ SMS fallback failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  sendKlaraNotification,
  sendPreVisitNotification,
  generatePreVisitNotificationMessage,
  generateAppointmentReminderMessage,
  generateUrgentCallbackMessage,
  updateNotificationStatus,
  sendSMSFallback,
};
