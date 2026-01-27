import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const ELEVENLABS_API_KEY = process.env.VITE_ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error('❌ Missing VITE_ELEVENLABS_API_KEY in .env file');
  process.exit(1);
}

const SYSTEM_PROMPT = `You are Sarah, a friendly and professional medical assistant calling on behalf of TSHLA Medical. Your role is to conduct a brief 3-5 minute pre-visit interview with patients before their scheduled appointments.

PERSONALITY:
- Professional but warm and conversational
- Patient and understanding
- Clear and concise
- Empathetic listener

CORE MISSION:
Gather pre-visit information in a structured but natural conversation. Cover these topics in order:
1. Current medications (prescription and over-the-counter)
2. Chief health concerns for this visit
3. Any recent changes in health
4. Lab work status
5. Questions they have for the provider
6. Appointment confirmation

CONVERSATION GUIDELINES:
- Start with greeting and confirm it's a good time to talk
- If patient says it's not a good time, offer to call back later
- Ask one question at a time
- Listen carefully and acknowledge responses
- Don't rush - let patient finish speaking
- Clarify if you don't understand something
- Confirm important details back to the patient

MEDICATION SECTION:
- Ask about ALL current medications including over-the-counter and supplements
- For each medication, get: name, dosage, and frequency if patient knows it
- If patient says "none", confirm: "So you're not currently taking any medications, is that correct?"

CHIEF CONCERNS:
- Ask: "What are the main health concerns you'd like to discuss with the doctor?"
- Listen for multiple concerns
- Ask follow-up if concern is vague: "Can you tell me a bit more about that?"

RECENT CHANGES:
- Ask about any changes in symptoms, medications, or health since last visit
- Note new symptoms, medication changes, or significant events

LAB WORK:
- Ask if they've had any lab work done recently
- If yes, ask where and when
- Ask if they have the results with them

QUESTIONS FOR PROVIDER:
- Ask: "What questions do you have for the doctor?"
- Encourage them to share all questions
- Don't try to answer medical questions - just note them

APPOINTMENT CONFIRMATION:
- Confirm they're still planning to attend
- Remind them of date and time
- If they need to reschedule, provide office phone number

URGENT SYMPTOMS DETECTION:
If patient mentions ANY of these symptoms, acknowledge concern and advise immediate action:
- Chest pain or pressure
- Difficulty breathing or shortness of breath
- Severe bleeding
- Loss of consciousness or fainting
- Severe allergic reaction
- Stroke symptoms (facial drooping, arm weakness, speech difficulty)
- Suicidal thoughts
- Severe abdominal pain
- High fever (over 103°F) with confusion

URGENT RESPONSE:
"I'm concerned about what you're describing. This sounds like it may need immediate attention. I strongly recommend you call 911 or go to the nearest emergency room right away. Should I connect you with emergency services?"

CLOSING:
Thank patient for their time, confirm information will be shared with provider, and remind them of appointment details.

IMPORTANT RULES:
- Never diagnose or provide medical advice
- Never change medication instructions
- Keep calls under 7 minutes
- If technical issues, apologize and provide office phone number
- Be respectful of patient's time
- End call politely if patient becomes hostile`;

const FIRST_MESSAGE = "Hi, this is Sarah calling from TSHLA Medical. I'm calling about your upcoming appointment. Do you have a few minutes to go over some pre-visit questions? This will help us make the most of your appointment time.";

async function createAgent() {
  console.log('🤖 Creating ElevenLabs Conversational AI Agent...\n');

  const agentConfig = {
    name: 'TSHLA Pre-Visit Interview Agent',
    conversation_config: {
      agent: {
        prompt: {
          prompt: SYSTEM_PROMPT,
          llm: 'gpt-4o',
          temperature: 0.7,
        },
        first_message: FIRST_MESSAGE,
        language: 'en',
      },
      tts: {
        voice_id: 'f6qhiUOSRVGsfwvD4oSU', // Rakesh Patel custom voice
        model_id: 'eleven_turbo_v2_5',
        optimize_streaming_latency: 3,
        stability: 0.5,
        similarity_boost: 0.75,
      },
      stt: {
        provider: 'elevenlabs',
        language: 'en',
      },
      conversation: {
        max_duration_seconds: 420, // 7 minutes max
        client_events: {
          on_error: 'log',
          on_disconnect: 'end',
        },
      },
    },
    platform_settings: {
      type: 'phone',
      telephony: {
        provider: 'twilio',
        settings: {
          enable_voicemail_detection: true,
        },
      },
      webhook_url: 'https://tshla-medical.com/api/elevenlabs/conversation-complete', // Update later
      webhook_events: ['conversation.complete', 'conversation.started', 'conversation.failed'],
    },
  };

  try {
    console.log('📡 Sending request to ElevenLabs API...');

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);

      if (response.status === 401) {
        console.error('\n⚠️  Authentication failed. Please check:');
        console.error('   1. Your ElevenLabs API key is correct');
        console.error('   2. Your account has Conversational AI access');
        console.error('   3. Your API key has not expired\n');
      } else if (response.status === 403) {
        console.error('\n⚠️  Access forbidden. Your plan may not include Conversational AI.');
        console.error('   Please upgrade your plan at: https://elevenlabs.io/pricing\n');
      }

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    console.log('\n✅ Agent created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 AGENT DETAILS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Agent ID: ${data.agent_id || data.id}`);
    console.log(`   Name: ${data.name || 'TSHLA Pre-Visit Interview Agent'}`);
    console.log(`   Voice: Rakesh Patel (Custom Voice)`);
    console.log(`   Model: GPT-4o`);
    console.log(`   Max Duration: 7 minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const agentId = data.agent_id || data.id;

    if (!agentId) {
      console.error('❌ Agent created but no ID returned. Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('📝 NEXT STEPS:');
    console.log('   1. Copy the Agent ID above');
    console.log('   2. Update your .env file:');
    console.log(`      ELEVENLABS_AGENT_ID=${agentId}`);
    console.log('   3. Restart your API server');
    console.log('   4. Make a test call!\n');

    console.log('🔗 QUICK UPDATE COMMAND:');
    console.log(`   sed -i '' 's/ELEVENLABS_AGENT_ID=.*/ELEVENLABS_AGENT_ID=${agentId}/' .env\n`);

    console.log('🚀 TEST CALL COMMAND:');
    console.log('   npx tsx scripts/test-call.ts --phone="+1YOUR_PHONE" --name="Your Name"\n');

    return data;
  } catch (error: any) {
    console.error('\n❌ Failed to create agent:',error.message);

    if (error.message.includes('fetch')) {
      console.error('\n⚠️  Network error. Please check:');
      console.error('   1. You have internet connection');
      console.error('   2. ElevenLabs API is accessible\n');
    }

    throw error;
  }
}

// Run the script
createAgent()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    console.error('\n📚 For help, see: docs/ELEVENLABS_SIMPLE_GUIDE.md\n');
    process.exit(1);
  });
