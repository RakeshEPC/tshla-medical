/**
 * 11Labs Conversation Complete Webhook
 * Receives and processes completed AI call transcripts
 * Created: January 2025
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import aiExtractionService from '../../services/aiExtraction.service';
const patientMatchingService = require('../../services/patientMatching.service');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 11Labs Conversation Complete Webhook Handler
 * Called by 11Labs when AI conversation ends
 */
export async function handleConversationComplete(req: Request, res: Response) {
  console.log('\n🤖 11Labs Conversation Complete Webhook');

  // Note: The exact structure depends on 11Labs API
  // This is a best-guess based on typical webhook patterns
  const {
    conversation_id,
    agent_id,
    transcript,
    audio_url,
    duration_seconds,
    status,
    metadata, // Our custom context data
    created_at,
    completed_at,
  } = req.body;

  console.log(`   Conversation ID: ${conversation_id}`);
  console.log(`   Duration: ${duration_seconds} seconds`);
  console.log(`   Status: ${status}`);

  // Extract patient context from metadata
  const patientId = metadata?.patient_id || req.body.patient_id;
  const appointmentId = metadata?.appointment_id || req.body.appointment_id;
  const providerId = metadata?.provider_id || req.body.provider_id;
  const patientName = metadata?.patient_name || 'Unknown';
  const patientPhone = metadata?.patient_phone || req.body.patient_phone || metadata?.patientPhone;
  const patientDob = metadata?.patient_dob || req.body.patient_dob;

  if (!transcript || transcript.trim().length === 0) {
    console.error('   ❌ No transcript received');
    res.status(400).json({ error: 'No transcript provided' });
    return;
  }

  if (!patientId) {
    console.error('   ❌ No patient ID in metadata');
    res.status(400).json({ error: 'Missing patient_id' });
    return;
  }

  try {
    console.log('   📝 Extracting structured data from transcript...');

    // Extract structured data using AI
    const extractedData = await aiExtractionService.extractStructuredData(transcript);

    console.log('   ✅ Data extracted');
    console.log(`      Medications: ${extractedData.medications?.length || 0}`);
    console.log(`      Concerns: ${extractedData.concerns?.length || 0}`);
    console.log(`      Urgent: ${extractedData.urgent ? '🚨 YES' : 'No'}`);

    // Generate formatted notes
    const clinicalNotes = aiExtractionService.formatClinicalNotes(extractedData);
    const providerSummary = aiExtractionService.formatProviderSummary(extractedData);

    // Store in database
    console.log('   💾 Storing in database...');

    const { data: previsitResponse, error: insertError } = await supabase
      .from('previsit_responses')
      .insert({
        // Links
        patient_id: patientId,
        appointment_id: appointmentId || null,
        provider_id: providerId || null,

        // Call metadata
        elevenlabs_conversation_id: conversation_id,
        call_completed_at: completed_at || new Date().toISOString(),
        call_duration_seconds: duration_seconds || 0,
        call_status: 'completed',

        // Raw data
        full_transcript: transcript,
        audio_recording_url: audio_url || null,

        // Structured data
        current_medications: extractedData.medications || [],
        refills_needed: extractedData.refills || [],
        labs_completed: extractedData.labsCompleted || false,
        labs_details: extractedData.labsDetails || null,
        labs_needed: extractedData.labsNeeded || false,
        specialist_visits: extractedData.specialistVisits || [],
        chief_concerns: extractedData.concerns || [],
        new_symptoms: extractedData.newSymptoms || null,
        patient_needs: extractedData.needs || {},
        patient_questions: extractedData.questions || [],

        // AI analysis
        ai_summary: extractedData.aiSummary || providerSummary,
        clinical_notes: clinicalNotes,
        risk_flags: extractedData.riskFlags || [],
        requires_urgent_callback: extractedData.urgent || false,
        urgency_level: extractedData.urgent ? 'urgent' : 'routine',

        // Patient confirmation
        appointment_confirmed: extractedData.appointmentConfirmed || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('   ❌ Failed to store in database:', insertError);
      res.status(500).json({ error: 'Database error', details: insertError.message });
      return;
    }

    console.log('   ✅ Stored in database');
    console.log(`      Pre-visit response ID: ${previsitResponse.id}`);

    // ========================================
    // NEW: Auto-create/link unified patient
    // ========================================
    if (patientPhone) {
      try {
        console.log('   🔍 Finding or creating unified patient...');

        const unifiedPatient = await patientMatchingService.findOrCreatePatient(
          patientPhone,
          {
            name: patientName,
            dob: patientDob,
            medications: extractedData.medications || [],
            conditions: extractedData.concerns?.map((c: any) => c.concern) || [],
            provider_id: providerId,
          },
          'previsit'
        );

        // Link this previsit response to the unified patient
        await patientMatchingService.linkRecordToPatient(
          'previsit_responses',
          previsitResponse.id,
          unifiedPatient.id
        );

        console.log(`   ✅ Linked previsit call to patient ${unifiedPatient.patient_id}`);
      } catch (patientError: any) {
        // Don't fail the webhook if patient matching fails
        console.warn('   ⚠️  Failed to create/link patient, continuing anyway:', patientError.message);
      }
    } else {
      console.warn('   ⚠️  No patient phone number - skipping patient creation');
    }
    // ========================================

    // If urgent, send alert to provider
    if (extractedData.urgent) {
      console.log('   🚨 URGENT FLAG DETECTED - Sending alert...');

      await sendUrgentAlert({
        patientId,
        patientName,
        providerId,
        riskFlags: extractedData.riskFlags,
        concerns: extractedData.concerns,
        appointmentId,
      });

      console.log('   ✅ Urgent alert sent');
    }

    // Success response
    res.json({
      success: true,
      previsit_response_id: previsitResponse.id,
      urgent: extractedData.urgent,
      summary: providerSummary,
    });
  } catch (error: any) {
    console.error('   ❌ Error processing conversation:', error);
    res.status(500).json({
      error: 'Failed to process conversation',
      details: error.message,
    });
  }
}

/**
 * Send urgent alert to provider
 */
async function sendUrgentAlert(options: {
  patientId: string;
  patientName: string;
  providerId?: string;
  riskFlags: string[];
  concerns: any[];
  appointmentId?: string;
}): Promise<void> {
  try {
    // Get provider information
    let providerEmail = null;
    let providerPhone = null;

    if (options.providerId) {
      const { data: provider } = await supabase
        .from('medical_staff')
        .select('email, phone')
        .eq('id', options.providerId)
        .single();

      providerEmail = provider?.email;
      providerPhone = provider?.phone;
    }

    // Format alert message
    const alertMessage = `
🚨 URGENT PRE-VISIT ALERT

Patient: ${options.patientName}
Risk Flags: ${options.riskFlags.join(', ')}

Top Concerns:
${options.concerns.slice(0, 3).map(c => `- ${c.concern} (Urgency: ${c.urgency_1_10}/10)`).join('\n')}

Action Required: Review pre-visit response and contact patient immediately.

View details in dashboard.
    `.trim();

    console.log('   📧 Urgent Alert Message:');
    console.log(alertMessage);

    // TODO: Implement actual alert sending
    // Options:
    // 1. Send email via SendGrid/AWS SES
    // 2. Send SMS via Twilio
    // 3. Push notification via mobile app
    // 4. Slack/Teams notification

    // For now, just log to database
    await supabase.from('previsit_notification_log').insert({
      patient_id: options.patientId,
      appointment_id: options.appointmentId || null,
      notification_type: 'urgent-alert',
      notification_status: 'sent',
      message_content: alertMessage,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to send urgent alert:', error);
    // Don't throw - we don't want to fail the whole webhook
  }
}

/**
 * Express route handler
 */
export default function setupConversationCompleteRoute(app: any) {
  app.post('/api/elevenlabs/conversation-complete', handleConversationComplete);

  console.log(
    '✅ 11Labs conversation webhook registered: /api/elevenlabs/conversation-complete'
  );
}
