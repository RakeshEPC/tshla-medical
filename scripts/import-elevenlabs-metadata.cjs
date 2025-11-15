/**
 * Import metadata from ElevenLabs conversations into database
 * This imports what we CAN get (phone, duration, status) even though transcripts are redacted
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenLabsAgentId = process.env.ELEVENLABS_AGENT_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

async function importMetadata() {
  console.log('📥 Importing ElevenLabs Conversation Metadata');
  console.log('============================================\n');

  try {
    // Get all conversations from ElevenLabs
    console.log('📞 Fetching conversations from ElevenLabs...');
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${elevenLabsAgentId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch from ElevenLabs');
      return;
    }

    const data = await response.json();
    const conversations = data.conversations || [];
    console.log(`✅ Found ${conversations.length} conversations\n`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const conv of conversations) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('previsit_call_data')
          .select('id')
          .eq('conversation_id', conv.conversation_id)
          .single();

        if (existing) {
          console.log(`⏭️  Skipping ${conv.conversation_id} (already exists)`);
          skipped++;
          continue;
        }

        // Get detailed conversation data (includes phone number)
        const detailResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conv.conversation_id}`, {
          headers: {
            'xi-api-key': elevenLabsApiKey
          }
        });

        if (!detailResponse.ok) {
          console.log(`⚠️  Could not get details for ${conv.conversation_id}`);
          failed++;
          continue;
        }

        const detail = await detailResponse.json();
        const phoneNumber = detail.metadata?.phone_call?.external_number || null;
        const direction = detail.metadata?.phone_call?.direction || 'unknown';

        // Insert into database
        const { error: insertError } = await supabase
          .from('previsit_call_data')
          .insert({
            conversation_id: conv.conversation_id,
            phone_number: phoneNumber,
            started_at: new Date(conv.start_time_unix_secs * 1000).toISOString(),
            completed_at: conv.status === 'done'
              ? new Date((conv.start_time_unix_secs + conv.call_duration_secs) * 1000).toISOString()
              : null,
            medications: [],
            concerns: [],
            questions: [],
            urgency_flags: [],
            structured_data: {
              call_duration_secs: conv.call_duration_secs,
              message_count: conv.message_count,
              call_successful: conv.call_successful,
              direction: direction,
              summary: detail.analysis?.transcript_summary || null,
              status: conv.status
            }
          });

        if (insertError) {
          console.error(`❌ Failed to insert ${conv.conversation_id}:`, insertError.message);
          failed++;
        } else {
          console.log(`✅ Imported ${conv.conversation_id} (${phoneNumber || 'no phone'}, ${Math.floor(conv.call_duration_secs / 60)}m ${conv.call_duration_secs % 60}s)`);
          imported++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing ${conv.conversation_id}:`, error.message);
        failed++;
      }
    }

    console.log(`\n\n📊 Import Summary:`);
    console.log(`Total conversations: ${conversations.length}`);
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped (already exist): ${skipped}`);
    console.log(`❌ Failed: ${failed}`);

    console.log(`\n💡 Note: Transcripts are redacted by ZRM, but we imported:`);
    console.log(`   - Phone numbers`);
    console.log(`   - Call duration`);
    console.log(`   - Timestamps`);
    console.log(`   - Status/success`);
    console.log(`   - AI summaries (if available)`);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

importMetadata().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
