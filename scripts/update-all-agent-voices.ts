import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;

const AGENT_IDS = {
  previsit: process.env.ELEVENLABS_AGENT_ID || 'agent_9301k9t886rcewfr8q2qt6e5vcxn',
  diabetes_en: process.env.ELEVENLABS_DIABETES_AGENT_EN || 'agent_6101kbk0qsmfefftpw6sf9k0wfyb',
  diabetes_es: process.env.ELEVENLABS_DIABETES_AGENT_ES || 'agent_8301kbk0jvacfqbsn5f4qzjn57dd',
  diabetes_hi: process.env.ELEVENLABS_DIABETES_AGENT_HI || 'agent_7001kbk0byh7fm6rmnbv1adb6rxn',
};

if (!ELEVENLABS_API_KEY) {
  console.error('❌ Missing ELEVENLABS_API_KEY in .env file');
  process.exit(1);
}

async function updateAgentVoice(agentId: string, agentName: string) {
  console.log(`\n🔄 Updating ${agentName}...`);
  console.log(`   Agent ID: ${agentId}`);

  try {
    // Get current configuration
    const getResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`   ❌ Failed to get agent (${getResponse.status}):`, errorText);
      return false;
    }

    const currentAgent = await getResponse.json();
    const currentVoice = currentAgent.conversation_config?.tts?.voice_id || 'unknown';
    console.log(`   Current voice: ${currentVoice}`);

    // Update voice
    const updatePayload = {
      conversation_config: {
        tts: {
          voice_id: 'f6qhiUOSRVGsfwvD4oSU', // Rakesh Patel custom voice
        },
      },
    };

    const patchResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      console.error(`   ❌ Failed to update (${patchResponse.status}):`, errorText);
      return false;
    }

    console.log(`   ✅ Updated to Rakesh Patel voice (f6qhiUOSRVGsfwvD4oSU)`);
    return true;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function updateAllAgents() {
  console.log('🎙️  Updating all ElevenLabs agents to use Rakesh Patel voice\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const results = {
    'Pre-Visit Agent': await updateAgentVoice(AGENT_IDS.previsit, 'Pre-Visit Agent'),
    'Diabetes Education (EN)': await updateAgentVoice(AGENT_IDS.diabetes_en, 'Diabetes Education (English)'),
    'Diabetes Education (ES)': await updateAgentVoice(AGENT_IDS.diabetes_es, 'Diabetes Education (Spanish)'),
    'Diabetes Education (HI)': await updateAgentVoice(AGENT_IDS.diabetes_hi, 'Diabetes Education (Hindi)'),
  };

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 UPDATE SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Object.entries(results).forEach(([name, success]) => {
    console.log(`   ${success ? '✅' : '❌'} ${name}`);
  });

  const allSuccess = Object.values(results).every((v) => v);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (allSuccess) {
    console.log('✅ All agents updated successfully!');
    console.log('   All calls will now use Rakesh Patel\'s voice.\n');
  } else {
    console.log('⚠️  Some agents failed to update. Check errors above.\n');
    process.exit(1);
  }
}

// Run the script
updateAllAgents()
  .then(() => {
    console.log('✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
