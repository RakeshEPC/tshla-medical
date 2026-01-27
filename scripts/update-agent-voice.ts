import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_9301k9t886rcewfr8q2qt6e5vcxn';

if (!ELEVENLABS_API_KEY) {
  console.error('❌ Missing ELEVENLABS_API_KEY in .env file');
  process.exit(1);
}

async function updateAgentVoice() {
  console.log('🔄 Updating ElevenLabs Agent Voice...\n');
  console.log(`   Agent ID: ${ELEVENLABS_AGENT_ID}`);
  console.log(`   New Voice: Rakesh Patel (f6qhiUOSRVGsfwvD4oSU)\n`);

  try {
    // First, get the current agent configuration
    console.log('📡 Fetching current agent configuration...');

    const getResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`❌ Failed to get agent (${getResponse.status}):`, errorText);
      throw new Error(`HTTP ${getResponse.status}: ${errorText}`);
    }

    const currentAgent = await getResponse.json();
    console.log('✅ Current agent fetched successfully\n');
    console.log(`   Current voice ID: ${currentAgent.conversation_config?.tts?.voice_id || 'unknown'}\n`);

    // Update only the TTS voice_id (minimal update to avoid conflicts)
    const updatePayload = {
      conversation_config: {
        tts: {
          voice_id: 'f6qhiUOSRVGsfwvD4oSU', // Rakesh Patel custom voice
        },
      },
    };

    // Send PATCH request to update the agent
    console.log('📡 Updating agent voice...');

    const patchResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      console.error(`❌ Failed to update agent (${patchResponse.status}):`, errorText);
      throw new Error(`HTTP ${patchResponse.status}: ${errorText}`);
    }

    const updatedAgent = await patchResponse.json();

    console.log('\n✅ Agent voice updated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 UPDATED AGENT DETAILS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Agent ID: ${ELEVENLABS_AGENT_ID}`);
    console.log(`   Name: ${updatedAgent.name || 'TSHLA Pre-Visit Interview Agent'}`);
    console.log(`   Voice: Rakesh Patel (Custom Voice)`);
    console.log(`   Voice ID: f6qhiUOSRVGsfwvD4oSU`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ The agent is now using Rakesh Patel\'s voice!');
    console.log('   All new calls will use the updated voice.\n');

    return updatedAgent;
  } catch (error: any) {
    console.error('\n❌ Failed to update agent:', error.message);

    if (error.message.includes('fetch')) {
      console.error('\n⚠️  Network error. Please check:');
      console.error('   1. You have internet connection');
      console.error('   2. ElevenLabs API is accessible\n');
    }

    throw error;
  }
}

// Run the script
updateAgentVoice()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
