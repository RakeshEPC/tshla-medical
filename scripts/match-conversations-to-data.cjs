/**
 * Check if ElevenLabs conversations have matching structured data
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenLabsAgentId = process.env.ELEVENLABS_AGENT_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatching() {
  console.log('🔍 Checking ElevenLabs Conversations vs Database Data');
  console.log('====================================================\n');

  try {
    // Get ElevenLabs conversations
    console.log('📞 Fetching ElevenLabs conversations...');
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${elevenLabsAgentId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch from ElevenLabs:', response.status);
      return;
    }

    const data = await response.json();
    const conversations = data.conversations || [];
    console.log(`✅ Found ${conversations.length} ElevenLabs conversations\n`);

    // Get database records
    console.log('📊 Fetching database records...');
    const { data: dbRecords, error } = await supabase
      .from('previsit_call_data')
      .select('*');

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`✅ Found ${dbRecords?.length || 0} database records\n`);

    // Match them
    console.log('🔗 Matching conversations to database records...\n');

    const conversationIds = conversations.map(c => c.conversation_id);
    const dbConversationIds = (dbRecords || []).map(r => r.conversation_id);

    console.log('ElevenLabs Conversation IDs (first 5):');
    conversationIds.slice(0, 5).forEach((id, idx) => {
      console.log(`  ${idx + 1}. ${id}`);
    });

    console.log('\nDatabase Conversation IDs:');
    dbConversationIds.forEach((id, idx) => {
      console.log(`  ${idx + 1}. ${id}`);
    });

    const matched = conversationIds.filter(id => dbConversationIds.includes(id));
    const unmatched = conversationIds.filter(id => !dbConversationIds.includes(id));

    console.log(`\n\n📊 Results:`);
    console.log(`Total ElevenLabs conversations: ${conversationIds.length}`);
    console.log(`Total database records: ${dbConversationIds.length}`);
    console.log(`Matched: ${matched.length}`);
    console.log(`Unmatched (missing from database): ${unmatched.length}`);

    if (unmatched.length > 0) {
      console.log(`\n⚠️  Missing Conversations (not saved to database):`);
      unmatched.slice(0, 10).forEach((id, idx) => {
        const conv = conversations.find(c => c.conversation_id === id);
        console.log(`  ${idx + 1}. ${id}`);
        console.log(`     Date: ${new Date(conv.start_time_unix_secs * 1000).toLocaleString()}`);
        console.log(`     Duration: ${Math.floor(conv.call_duration_secs / 60)}m ${conv.call_duration_secs % 60}s`);
        console.log(`     Status: ${conv.call_successful}`);
      });

      console.log(`\n💡 Solution: The real-time webhook endpoints need to capture data DURING calls.`);
      console.log(`   These conversations happened but data wasn't saved to the database.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMatching().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
