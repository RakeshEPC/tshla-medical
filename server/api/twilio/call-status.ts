/**
 * Twilio Call Status Webhook
 * Receives call status updates from Twilio
 * Created: January 2025
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Call Status Webhook Handler
 * Called by Twilio when call status changes
 */
export async function handleCallStatus(req: Request, res: Response) {
  console.log('\n📊 Call Status Webhook');

  const {
    CallSid,
    CallStatus,
    CallDuration,
    From,
    To,
    Direction,
    AnsweredBy,
    // Custom parameters we passed
    patientId,
    appointmentId,
  } = req.body;

  console.log(`   Call SID: ${CallSid}`);
  console.log(`   Status: ${CallStatus}`);
  console.log(`   Duration: ${CallDuration} seconds`);
  console.log(`   Answered By: ${AnsweredBy || 'N/A'}`);

  try {
    // Update call log in database
    const { error: updateError } = await supabase
      .from('previsit_call_log')
      .update({
        call_status: mapTwilioStatus(CallStatus),
        call_duration_seconds: parseInt(CallDuration) || 0,
        notes: AnsweredBy ? `Answered by: ${AnsweredBy}` : null,
      })
      .eq('twilio_call_sid', CallSid);

    if (updateError) {
      console.error('   ❌ Failed to update call log:', updateError);
    } else {
      console.log('   ✅ Call log updated');
    }

    // If call completed, check if we need to create a placeholder pre-visit response
    // (The actual response will be filled in by 11Labs webhook)
    if (CallStatus === 'completed') {
      console.log('   ℹ️  Call completed - waiting for 11Labs webhook');

      // Check if response already exists
      const { data: existing } = await supabase
        .from('previsit_responses')
        .select('id')
        .eq('call_sid', CallSid)
        .single();

      if (!existing) {
        // Create placeholder that will be updated by 11Labs
        await supabase.from('previsit_responses').insert({
          call_sid: CallSid,
          patient_id: patientId || null,
          appointment_id: appointmentId || null,
          call_status: 'completed',
          call_completed_at: new Date().toISOString(),
          call_duration_seconds: parseInt(CallDuration) || 0,
          // Other fields will be filled by 11Labs webhook
        });

        console.log('   ✅ Placeholder pre-visit response created');
      }
    }

    // If call failed
    if (CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
      console.log(`   ⚠️  Call ${CallStatus} - may need retry`);

      // Log the failure
      await supabase.from('previsit_call_log').insert({
        twilio_call_sid: CallSid,
        call_status: mapTwilioStatus(CallStatus),
        call_time: new Date().toISOString(),
        notes: `Call ${CallStatus}`,
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('   ❌ Error handling call status:', error);
    res.sendStatus(500);
  }
}

/**
 * Map Twilio call status to our database status
 */
function mapTwilioStatus(twilioStatus: string): string {
  const statusMap: Record<string, string> = {
    queued: 'initiated',
    ringing: 'initiated',
    'in-progress': 'in-progress',
    completed: 'completed',
    busy: 'busy',
    failed: 'failed',
    'no-answer': 'no-answer',
    canceled: 'failed',
  };

  return statusMap[twilioStatus] || twilioStatus;
}

/**
 * Express route handler
 */
export default function setupCallStatusRoute(app: any) {
  app.post('/api/twilio/call-status', handleCallStatus);

  console.log('✅ Twilio call status webhook registered: /api/twilio/call-status');
}
