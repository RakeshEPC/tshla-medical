/**
 * Twilio Media Stream Status Callback Handler
 *
 * Receives lifecycle events from Twilio Media Streams:
 * - stream-start: Stream successfully started
 * - stream-stop: Stream ended
 *
 * This is CRITICAL for debugging "application error" issues.
 * If you never see "stream-start", the WebSocket handshake failed.
 *
 * Twilio Docs: https://www.twilio.com/docs/voice/media-streams
 */

/**
 * Handle stream status callbacks
 * POST /api/twilio/stream-status
 */
async function handler(req, res) {
  console.log('\n🔔 [StreamStatus] Twilio callback received');

  try {
    const {
      CallSid,
      StreamSid,
      AccountSid,
      Timestamp,
      SequenceNumber
    } = req.body;

    console.log(`   Call SID: ${CallSid}`);
    console.log(`   Stream SID: ${StreamSid}`);
    console.log(`   Timestamp: ${Timestamp}`);
    console.log(`   Sequence: ${SequenceNumber}`);
    console.log(`   Full body:`, JSON.stringify(req.body, null, 2));

    // Log to help debug "application error"
    // If stream never starts, we know the WS handshake failed
    if (req.body.Status) {
      console.log(`   📊 STATUS: ${req.body.Status}`);
    }

    // Always respond 200 OK to Twilio
    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ [StreamStatus] Error:', error.message);
    res.status(200).send('OK'); // Still return 200 to Twilio
  }
}

module.exports = handler;
