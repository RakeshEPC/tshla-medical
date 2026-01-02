/**
 * Diabetes Education Call Cleanup Handler
 * Removes patient data from ElevenLabs Knowledge Base after call ends
 *
 * This endpoint can be triggered by:
 * 1. Twilio status callback (when call completes)
 * 2. ElevenLabs conversation-complete webhook
 * 3. Manual cleanup scripts
 *
 * Created: 2026-01-01
 */

const { createClient } = require('@supabase/supabase-js');
const kbService = require('../../services/elevenLabsKnowledgeBase.service');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ElevenLabs Agent IDs by language (same as inbound handler)
const AGENT_IDS = {
  'en': process.env.ELEVENLABS_DIABETES_AGENT_EN || '',
  'es': process.env.ELEVENLABS_DIABETES_AGENT_ES || '',
  'hi': process.env.ELEVENLABS_DIABETES_AGENT_HI || '',
};

/**
 * Handle call cleanup - remove patient data from Knowledge Base
 *
 * Expected request body (from Twilio status callback):
 * {
 *   CallSid: 'CA...',
 *   CallStatus: 'completed',
 *   ...
 * }
 *
 * Or (from ElevenLabs webhook):
 * {
 *   conversation_id: '...',
 *   status: 'completed',
 *   metadata: { call_sid: 'CA...' }
 * }
 */
async function handler(req, res) {
  console.log('\n🧹 [DiabetesEdu Cleanup] Call cleanup requested');

  try {
    // Extract call identifier from different webhook formats
    const callSid = req.body.CallSid ||
                    req.body.call_sid ||
                    req.body.metadata?.call_sid ||
                    req.body.metadata?.twilio_call_sid;

    const conversationId = req.body.conversation_id || req.body.elevenlabs_conversation_id;

    console.log(`   Call SID: ${callSid || 'N/A'}`);
    console.log(`   Conversation ID: ${conversationId || 'N/A'}`);

    if (!callSid && !conversationId) {
      console.error('❌ [DiabetesEdu Cleanup] Missing call identifier');
      return res.status(400).json({
        error: 'Missing call_sid or conversation_id',
        message: 'Cannot identify which call to clean up'
      });
    }

    // Find the call in database - include language to determine which agent was used
    let query = supabase
      .from('diabetes_education_calls')
      .select('id, twilio_call_sid, kb_document_id, patient_id, language');

    if (callSid) {
      query = query.eq('twilio_call_sid', callSid);
    } else if (conversationId) {
      query = query.eq('elevenlabs_conversation_id', conversationId);
    }

    const { data: callRecord, error: lookupError } = await query.single();

    if (lookupError || !callRecord) {
      console.warn('⚠️  [DiabetesEdu Cleanup] Call record not found in database');
      console.warn('   This might be a duplicate cleanup request - ignoring');

      // Return 200 to prevent webhook retries
      return res.status(200).json({
        success: true,
        message: 'Call record not found - possibly already cleaned up',
        warning: 'no_record_found'
      });
    }

    console.log(`✅ [DiabetesEdu Cleanup] Found call record: ${callRecord.id}`);
    console.log(`   KB Document ID: ${callRecord.kb_document_id || 'N/A'}`);
    console.log(`   Language: ${callRecord.language}`);

    // Delete from Knowledge Base if document ID exists
    let kbDeleted = false;
    if (callRecord.kb_document_id) {
      // Determine which agent was used based on language
      const agentId = AGENT_IDS[callRecord.language] || AGENT_IDS['en'];

      console.log('[DiabetesEdu Cleanup] 🗑️  Cleaning up Knowledge Base...');
      console.log(`   Agent ID: ${agentId}`);

      try {
        // First, unlink document from agent
        if (agentId) {
          console.log('[DiabetesEdu Cleanup] 🔓 Unlinking document from agent...');
          const unlinked = await kbService.unlinkDocumentFromAgent(agentId, callRecord.kb_document_id);

          if (unlinked) {
            console.log('✅ [DiabetesEdu Cleanup] Document unlinked from agent');
          } else {
            console.warn('⚠️  [DiabetesEdu Cleanup] Failed to unlink (will try to delete anyway)');
          }
        }

        // Then, delete the document
        console.log('[DiabetesEdu Cleanup] 🗑️  Deleting KB document...');
        kbDeleted = await kbService.deletePatientFromKB(callRecord.kb_document_id);

        if (kbDeleted) {
          console.log('✅ [DiabetesEdu Cleanup] KB document deleted successfully');
        } else {
          console.warn('⚠️  [DiabetesEdu Cleanup] KB delete failed (non-fatal)');
        }
      } catch (kbError) {
        console.error('❌ [DiabetesEdu Cleanup] KB cleanup error:', kbError.message);
        // Continue anyway - cleanup is best-effort
      }
    } else {
      console.log('ℹ️  [DiabetesEdu Cleanup] No KB document to delete');
    }

    // Update call status in database
    const { error: updateError } = await supabase
      .from('diabetes_education_calls')
      .update({
        call_status: 'completed',
        call_ended_at: new Date().toISOString(),
        kb_document_id: null // Clear the document ID since it's deleted
      })
      .eq('id', callRecord.id);

    if (updateError) {
      console.error('❌ [DiabetesEdu Cleanup] Failed to update call status:', updateError);
    } else {
      console.log('✅ [DiabetesEdu Cleanup] Call status updated to completed');
    }

    console.log('✅ [DiabetesEdu Cleanup] Cleanup complete');

    return res.status(200).json({
      success: true,
      message: 'Cleanup completed successfully',
      call_id: callRecord.id,
      kb_deleted: kbDeleted
    });

  } catch (error) {
    console.error('❌ [DiabetesEdu Cleanup] Error during cleanup:', error);

    return res.status(500).json({
      error: 'Cleanup failed',
      message: error.message
    });
  }
}

module.exports = handler;
