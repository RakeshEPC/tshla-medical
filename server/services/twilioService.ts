/**
 * Twilio Service - DISABLED
 * Handles outbound calling for pre-visit patient interviews
 * Created: January 2025
 * DISABLED: 2026-01-03 - Twilio phone numbers cancelled
 */

import { createClient } from '@supabase/supabase-js';

// DISABLED: Twilio phone numbers cancelled - 2026-01-03
// Twilio will be installed later: npm install twilio
// For now, we'll set up the structure
let twilioClient: any = null;

// DISABLED - Do not initialize Twilio client
// try {
//   const twilio = require('twilio');
//   twilioClient = twilio(
//     process.env.TWILIO_ACCOUNT_SID,
//     process.env.TWILIO_AUTH_TOKEN
//   );
// } catch (error) {
//   console.warn('⚠️ Twilio SDK not installed. Run: npm install twilio');
// }
console.warn('⚠️ Twilio Service DISABLED - Phone numbers cancelled (2026-01-03)');

// Supabase client for logging
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Environment variables
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const OFFICE_PHONE_NUMBER = process.env.OFFICE_PHONE_NUMBER;

// =====================================================
// INTERFACES
// =====================================================

export interface InitiatePreVisitCallOptions {
  patientId: string; // UUID
  patientName: string;
  patientPhone: string;
  appointmentId?: string; // UUID
  appointmentDate: string; // ISO date
  appointmentTime: string; // HH:MM format
  providerName: string;
  providerId: string;
  attemptNumber: number; // 1, 2, or 3
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
  status?: string;
}

// =====================================================
// CALL LOGGING
// =====================================================

/**
 * Log call attempt to database
 */
async function logCallAttempt(data: {
  patientId: string;
  appointmentId?: string;
  attemptNumber: number;
  twilioCallSid?: string;
  status: string;
  notes?: string;
}): Promise<void> {
  try {
    await supabase.from('previsit_call_log').insert({
      patient_id: data.patientId,
      appointment_id: data.appointmentId || null,
      attempt_number: data.attemptNumber,
      call_status: data.status,
      twilio_call_sid: data.twilioCallSid || null,
      notes: data.notes || null,
    });
  } catch (error) {
    console.error('Failed to log call attempt:', error);
  }
}

// =====================================================
// MAIN CALLING FUNCTION
// =====================================================

/**
 * Initiate a pre-visit call to a patient
 * DISABLED: Twilio phone numbers cancelled - 2026-01-03
 */
export async function initiatePreVisitCall(
  options: InitiatePreVisitCallOptions
): Promise<CallResult> {
  // DISABLED: Twilio phone numbers cancelled
  const error = 'Twilio service disabled - phone numbers cancelled (2026-01-03)';
  console.error('❌', error);
  console.log(`   Patient: ${options.patientName} - Call attempt SKIPPED`);

  await logCallAttempt({
    patientId: options.patientId,
    appointmentId: options.appointmentId,
    attemptNumber: options.attemptNumber,
    status: 'failed',
    notes: error,
  });

  return { success: false, error };

  // OLD CODE PRESERVED BELOW (commented out)
  // console.log('\n📞 Initiating pre-visit call...');
  // console.log(`   Patient: ${options.patientName}`);
  // console.log(`   Phone: ${options.patientPhone}`);
  // console.log(`   Appointment: ${options.appointmentDate} at ${options.appointmentTime}`);
  // console.log(`   Attempt: #${options.attemptNumber}`);

  // if (!twilioClient) {
  //   const error = 'Twilio SDK not initialized. Install with: npm install twilio';
  //   console.error('❌', error);
  //   await logCallAttempt({
  //     patientId: options.patientId,
  //     appointmentId: options.appointmentId,
  //     attemptNumber: options.attemptNumber,
  //     status: 'failed',
  //     notes: error,
  //   });
  //   return { success: false, error };
  // }

  if (!TWILIO_PHONE_NUMBER) {
    const error = 'TWILIO_PHONE_NUMBER not set in environment';
    console.error('❌', error);
    await logCallAttempt({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      attemptNumber: options.attemptNumber,
      status: 'failed',
      notes: error,
    });
    return { success: false, error };
  }

  try {
    // Format appointment date for voice
    const appointmentDateFormatted = new Date(options.appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Create call via Twilio
    const call = await twilioClient.calls.create({
      to: options.patientPhone,
      from: TWILIO_PHONE_NUMBER,
      url: `${API_BASE_URL}/api/twilio/previsit-twiml`, // TwiML endpoint
      statusCallback: `${API_BASE_URL}/api/twilio/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',

      // Machine detection settings
      // Attempt 1: Hang up if voicemail, don't waste credits
      // Attempt 2-3: Leave voicemail message
      machineDetection: options.attemptNumber === 1 ? 'DetectMessageEnd' : 'Enable',
      asyncAmd: 'true', // Async answering machine detection

      timeout: 30, // Ring for 30 seconds before giving up

      // Pass context data via URL parameters (will be sent to webhook)
      // Note: These go in the statusCallback URL as query params
      statusCallbackMethod: 'POST',
    });

    // Twilio doesn't support custom params directly in create()
    // We'll pass them via the TwiML URL instead
    const twimlUrl = new URL(`${API_BASE_URL}/api/twilio/previsit-twiml`);
    twimlUrl.searchParams.set('patientId', options.patientId);
    twimlUrl.searchParams.set('patientName', options.patientName);
    twimlUrl.searchParams.set('appointmentId', options.appointmentId || '');
    twimlUrl.searchParams.set('appointmentDate', appointmentDateFormatted);
    twimlUrl.searchParams.set('appointmentTime', options.appointmentTime);
    twimlUrl.searchParams.set('providerName', options.providerName);
    twimlUrl.searchParams.set('providerId', options.providerId);
    twimlUrl.searchParams.set('attemptNumber', options.attemptNumber.toString());

    // Actually, we need to update the call creation
    const callWithParams = await twilioClient.calls.create({
      to: options.patientPhone,
      from: TWILIO_PHONE_NUMBER,
      url: twimlUrl.toString(),
      statusCallback: `${API_BASE_URL}/api/twilio/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: options.attemptNumber === 1 ? 'DetectMessageEnd' : 'Enable',
      asyncAmd: 'true',
      timeout: 30,
    });

    console.log(`✅ Call initiated. Twilio SID: ${callWithParams.sid}`);

    // Log call initiation
    await logCallAttempt({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      attemptNumber: options.attemptNumber,
      twilioCallSid: callWithParams.sid,
      status: 'initiated',
      notes: `Call to ${options.patientPhone} for appointment on ${options.appointmentDate}`,
    });

    return {
      success: true,
      callSid: callWithParams.sid,
      status: 'initiated',
    };
  } catch (error: any) {
    console.error('❌ Failed to initiate Twilio call:', error);

    await logCallAttempt({
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      attemptNumber: options.attemptNumber,
      status: 'failed',
      notes: error.message || 'Unknown error',
    });

    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Get voicemail message based on attempt number
 */
export function getVoicemailMessage(options: {
  patientName: string;
  providerName: string;
  appointmentDate: string;
  appointmentTime: string;
}): string {
  return `Hello, this is TSHLA Medical calling for ${options.patientName} about your upcoming appointment with Dr. ${options.providerName} on ${options.appointmentDate} at ${options.appointmentTime}. We wanted to do a quick pre-visit call to help prepare for your appointment. Please call us back at ${OFFICE_PHONE_NUMBER} at your convenience, or we'll see you at your scheduled time. Thank you!`;
}

/**
 * Check if call can be made (respects time windows)
 */
export function canMakeCallNow(attemptNumber: number): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday

  // No calls on Sundays
  if (day === 0) {
    console.log('⏸️ Cannot call on Sundays');
    return false;
  }

  // Respect business hours: 9 AM - 7 PM
  if (hour < 9 || hour >= 19) {
    console.log('⏸️ Outside business hours (9 AM - 7 PM)');
    return false;
  }

  // Attempt-specific time windows (for optimization, not enforcement)
  // Attempt 1: 10 AM - 12 PM (best response time)
  // Attempt 2: 2 PM - 4 PM (afternoon)
  // Attempt 3: 8 AM - 10 AM (morning of appointment)

  return true;
}

/**
 * Calculate optimal call time based on attempt number
 */
export function calculateOptimalCallTime(attemptNumber: number): Date {
  const now = new Date();
  let targetHour: number;

  switch (attemptNumber) {
    case 1:
      targetHour = 10; // 10 AM
      break;
    case 2:
      targetHour = 14; // 2 PM
      break;
    case 3:
      targetHour = 8; // 8 AM (day of appointment)
      break;
    default:
      targetHour = 10;
  }

  // Add randomness (±30 min) to distribute load
  const randomMinutes = Math.floor(Math.random() * 60) - 30;

  const callTime = new Date(now);
  callTime.setHours(targetHour, randomMinutes, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (callTime < now) {
    callTime.setDate(callTime.getDate() + 1);
  }

  return callTime;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  initiatePreVisitCall,
  getVoicemailMessage,
  canMakeCallNow,
  calculateOptimalCallTime,
};
