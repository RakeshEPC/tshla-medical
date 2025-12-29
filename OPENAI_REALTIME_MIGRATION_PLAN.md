# OpenAI Realtime API Migration Plan
## Diabetes Education Voice AI System

**Created:** 2025-12-29
**Status:** Planning Phase
**Priority:** HIGH - Required for patient context injection

---

## Problem Statement

### Current Architecture (ElevenLabs Conversational AI)
```
Phone Call → Twilio → ElevenLabs Conversational AI (black box) → Phone
                      ↑
                      ❌ NO way to inject patient context dynamically
```

**Critical Issue:**
- ElevenLabs Conversational AI uses its own LLM (not OpenAI GPT-4)
- Does NOT support dynamic variable injection via API
- `{{patient_context}}` in prompt is UI template only, not runtime variable
- Result: AI says outdated data (A1C 7.2% instead of 8.7%)

### Target Architecture (OpenAI Realtime API)
```
Phone Call → Twilio Media Stream → WebSocket Server → OpenAI Realtime API
                                          ↓                    ↑
                                    Patient Context      GPT-4o Realtime
                                    (Clinical Notes)           ↓
                                          ↓              Text-to-Speech
                                    ElevenLabs TTS ← Audio Response
                                          ↓
                                      Twilio → Phone
```

**Benefits:**
- ✅ Full control over conversation logic via OpenAI GPT-4o
- ✅ Dynamic patient context injection at session start
- ✅ Function calling support for future features
- ✅ ElevenLabs used ONLY for high-quality voice synthesis
- ✅ Real-time transcript and logging

---

## Architecture Components

### 1. Twilio Media Streams
- **Purpose:** Bridge phone call audio to WebSocket
- **Audio Format:** μ-law (G.711) 8kHz, base64 encoded
- **Connection:** Bidirectional WebSocket
- **TwiML Example:**
  ```xml
  <Response>
    <Say voice="alice">Connecting to your diabetes educator...</Say>
    <Connect>
      <Stream url="wss://your-server.com/media-stream" />
    </Connect>
  </Response>
  ```

### 2. WebSocket Relay Server (NEW)
- **File:** `server/openai-realtime-relay.js`
- **Framework:** Express + ws (WebSocket library)
- **Responsibilities:**
  1. Accept Twilio Media Stream connections
  2. Fetch patient data by phone number
  3. Build patient context string
  4. Establish OpenAI Realtime API session with context
  5. Relay audio between Twilio ↔ OpenAI
  6. Log transcripts and events
  7. (Optional) Send audio to ElevenLabs for TTS

### 3. OpenAI Realtime API
- **Model:** `gpt-4o-realtime-preview-2024-12-17`
- **Connection:** `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`
- **Audio Format:** PCM16 24kHz (or G.711 8kHz for direct Twilio compatibility)
- **Session Configuration:**
  ```json
  {
    "modalities": ["text", "audio"],
    "instructions": "You are a certified diabetes educator...\n\nPatient Context:\n{clinical_notes}\n{medical_data}",
    "voice": "alloy",
    "input_audio_format": "g711_ulaw",
    "output_audio_format": "g711_ulaw",
    "input_audio_transcription": {
      "model": "whisper-1"
    },
    "turn_detection": {
      "type": "server_vad"
    }
  }
  ```

### 4. Patient Context Injection
- **Source:** `diabetes_education_patients` table
- **Fields Used:**
  - `clinical_notes` (staff-entered notes)
  - `medical_data` (OpenAI-extracted from CCD)
  - `focus_areas` (tags like "Medication Adherence")
- **Format:**
  ```
  PATIENT INFORMATION:

  Clinical Notes:
  A1c is 8.7. gained 20 pounds in 2 months...

  Focus Areas: Medication Adherence, Weight Management

  Medical Data:
  - A1C: 8.7% (2025-12-15)
  - Medications: Metformin 1000mg twice daily, Jardiance 10mg daily
  - Diagnoses: Type 2 Diabetes Mellitus, Hypertension
  ```

### 5. ElevenLabs TTS (Optional Enhancement)
- **Current Plan:** Use OpenAI's built-in TTS (faster to implement)
- **Future Option:** Send OpenAI text responses to ElevenLabs for superior voice quality
- **Trade-off:** Adds latency (~500ms) but better voice naturalness

---

## Implementation Steps

### Phase 2A: Core Integration (4-6 hours)

#### Step 1: Create WebSocket Relay Server
**File:** `server/openai-realtime-relay.js`

```javascript
const express = require('express');
const expressWs = require('express-ws');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const app = express();
expressWs(app);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE = 'alloy'; // Options: alloy, echo, fable, onyx, nova, shimmer

// WebSocket endpoint for Twilio Media Streams
app.ws('/media-stream', async (ws, req) => {
  console.log('[Realtime] New Twilio connection');

  let streamSid = null;
  let callSid = null;
  let openAiWs = null;
  let patientContext = null;

  // Twilio → Server
  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    switch (data.event) {
      case 'start':
        streamSid = data.start.streamSid;
        callSid = data.start.callSid;

        // Extract caller phone number from Twilio
        const callerNumber = data.start.customParameters?.From ||
                           req.query.From;

        console.log(`[Realtime] Call started: ${callSid} from ${callerNumber}`);

        // Fetch patient data
        patientContext = await fetchPatientContext(callerNumber);

        // Connect to OpenAI Realtime API
        openAiWs = await connectToOpenAI(patientContext);

        // Forward OpenAI audio to Twilio
        openAiWs.on('message', (openAiMessage) => {
          handleOpenAIMessage(openAiMessage, ws, streamSid);
        });

        break;

      case 'media':
        // Forward Twilio audio to OpenAI
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: data.media.payload // base64 μ-law 8kHz
          }));
        }
        break;

      case 'stop':
        console.log('[Realtime] Call ended');
        if (openAiWs) openAiWs.close();
        break;
    }
  });

  ws.on('close', () => {
    console.log('[Realtime] Twilio disconnected');
    if (openAiWs) openAiWs.close();
  });
});

async function fetchPatientContext(phoneNumber) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: patient } = await supabase
    .from('diabetes_education_patients')
    .select('*')
    .eq('phone_number', phoneNumber)
    .eq('is_active', true)
    .single();

  if (!patient) {
    return 'No patient record found.';
  }

  // Build context string (reuse existing buildPatientContext logic)
  let context = '';

  if (patient.clinical_notes) {
    context += `Clinical Notes:\n${patient.clinical_notes}\n\n`;
  }

  if (patient.focus_areas?.length) {
    context += `Focus Areas: ${patient.focus_areas.join(', ')}\n\n`;
  }

  if (patient.medical_data) {
    context += `Medical Data:\n`;

    if (patient.medical_data.labs?.a1c) {
      context += `- A1C: ${patient.medical_data.labs.a1c.value}% (${patient.medical_data.labs.a1c.date})\n`;
    }

    if (patient.medical_data.medications?.length) {
      context += `- Medications: ${patient.medical_data.medications.map(m =>
        `${m.name} ${m.dose} ${m.frequency}`
      ).join(', ')}\n`;
    }
  }

  return context || 'No patient information available.';
}

async function connectToOpenAI(patientContext) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('[Realtime] Connected to OpenAI');

      // Configure session with patient context
      const systemInstructions = `You are a certified diabetes educator (CDE) providing personalized phone-based support.

PATIENT INFORMATION:
${patientContext}

GUIDELINES:
- Speak naturally and empathetically
- Reference specific values from the patient's record (A1C, medications, etc.)
- Focus on the patient's stated focus areas
- Keep responses concise (phone call format)
- Ask clarifying questions about their daily routines
- Provide actionable advice
- If asked about values you don't have, acknowledge you don't see that in their record

IMPORTANT: Always use the actual patient data provided above. Never make up values.`;

      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemInstructions,
          voice: VOICE,
          input_audio_format: 'g711_ulaw', // Match Twilio format
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));

      resolve(ws);
    });

    ws.on('error', (error) => {
      console.error('[Realtime] OpenAI error:', error);
      reject(error);
    });
  });
}

function handleOpenAIMessage(message, twilioWs, streamSid) {
  const data = JSON.parse(message);

  switch (data.type) {
    case 'response.audio.delta':
      // Send audio back to Twilio
      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid: streamSid,
        media: {
          payload: data.delta // base64 μ-law audio
        }
      }));
      break;

    case 'conversation.item.input_audio_transcription.completed':
      console.log('[Realtime] User said:', data.transcript);
      // TODO: Log to database
      break;

    case 'response.audio_transcript.done':
      console.log('[Realtime] AI said:', data.transcript);
      // TODO: Log to database
      break;

    case 'error':
      console.error('[Realtime] OpenAI error:', data.error);
      break;
  }
}

const PORT = process.env.REALTIME_PORT || 3002;
app.listen(PORT, () => {
  console.log(`[Realtime] WebSocket server running on port ${PORT}`);
});
```

#### Step 2: Update Twilio Inbound Handler
**File:** `server/api/twilio/diabetes-education-inbound.js`

Replace ElevenLabs URL generation with new WebSocket relay URL:

```javascript
// OLD (ElevenLabs Conversational AI)
const signedUrl = await getElevenLabsSignedUrl(agentId);

// NEW (OpenAI Realtime via our relay)
const realtimeUrl = process.env.OPENAI_REALTIME_RELAY_URL ||
  'wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/media-stream';

return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Connecting you to your diabetes educator. Please wait.
  </Say>
  <Connect>
    <Stream url="${realtimeUrl}?From=${encodeURIComponent(callerPhoneNumber)}" />
  </Connect>
</Response>`;
```

#### Step 3: Add Environment Variables
**File:** `.github/workflows/deploy-frontend.yml` (secrets section)

```yaml
OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
OPENAI_REALTIME_RELAY_URL: wss://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/media-stream
```

#### Step 4: Update Unified API Server
**File:** `server/unified-api-server.js`

Import and mount the new relay server:

```javascript
// Import OpenAI Realtime relay
const openaiRealtimeRelay = require('./openai-realtime-relay');

// Mount at root (relay server has its own routes)
app.use('/', openaiRealtimeRelay);
```

#### Step 5: Add Dependencies
**File:** `server/package.json`

```json
{
  "dependencies": {
    "ws": "^8.18.0",
    "express-ws": "^5.0.2"
  }
}
```

---

### Phase 2B: Transcript Logging (2 hours)

Add database logging to capture conversation transcripts:

**Table:** `diabetes_education_calls`
- Already has `transcript` column (TEXT)
- Add `conversation_events` column (JSONB) for detailed event log

**Implementation:**
- Buffer transcript events in memory during call
- On call end, combine and save to database
- Link to patient via `patient_id`

---

### Phase 2C: Testing & Validation (2 hours)

1. **Unit Test:** WebSocket relay connection handling
2. **Integration Test:** Full call flow with test patient data
3. **User Acceptance Test:**
   - Call 832-400-3930
   - Verify AI mentions correct A1C (8.7%)
   - Verify AI references clinical notes
   - Check transcript logging

---

## Audio Format Handling

### Twilio Media Streams Format
- **Codec:** G.711 μ-law (PCMU)
- **Sample Rate:** 8kHz
- **Encoding:** Base64
- **Channels:** Mono
- **Frame Size:** 20ms (160 bytes)

### OpenAI Realtime API Formats
- **Supported Input:** `g711_ulaw`, `g711_alaw`, `pcm16`
- **Recommended:** `g711_ulaw` (direct compatibility with Twilio)
- **No conversion needed** when using `g711_ulaw`

### Audio Flow
```
Caller speaks → Twilio (μ-law 8kHz) → WebSocket relay → OpenAI Realtime
                                                              ↓
Caller hears ← Twilio ← WebSocket relay ← OpenAI TTS (μ-law 8kHz)
```

---

## Cost Analysis

### Current (ElevenLabs Conversational AI)
- **Cost:** $0.15 per minute (includes STT + LLM + TTS)
- **Average Call:** 5 minutes = $0.75
- **Monthly (100 calls):** $75

### New (OpenAI Realtime API)
- **Cost:** $0.06/min input audio + $0.24/min output audio
- **Average Call:** 5 min = $0.30 input + $1.20 output = **$1.50**
- **Monthly (100 calls):** $150

**Cost Increase:** 2x more expensive BUT provides:
- ✅ Full control over conversation logic
- ✅ Dynamic patient context (solves core issue)
- ✅ Better transcript quality
- ✅ Function calling for future features
- ✅ Using OpenAI GPT-4o (superior reasoning)

---

## Rollback Plan

If OpenAI Realtime integration has issues:

1. Keep old ElevenLabs code in separate file (`diabetes-education-inbound.old.js`)
2. Feature flag: `ENABLE_OPENAI_REALTIME` env var
3. If false, fallback to ElevenLabs flow
4. Monitor error rates and call quality for 1 week
5. Full cutover after validation

---

## Open Questions

1. **ElevenLabs TTS Enhancement:** Should we add ElevenLabs voice for better quality?
   - **Pro:** Superior voice naturalness
   - **Con:** Added latency, complexity
   - **Decision:** Start with OpenAI TTS, add ElevenLabs later if needed

2. **Function Calling:** Should we enable function calling for medication reminders, appointment scheduling?
   - **Decision:** Phase 3 enhancement after core migration works

3. **Multiple Languages:** Does OpenAI Realtime support Spanish?
   - **Answer:** Yes, GPT-4o supports 50+ languages
   - **TODO:** Test Spanish voice quality

4. **Concurrency Limits:** How many simultaneous calls can we handle?
   - **OpenAI:** No session limit as of Feb 2025
   - **Server:** Need to load test WebSocket relay
   - **Recommendation:** Start with 10 concurrent, scale up

---

## Success Criteria

✅ **Phase 2 Complete When:**
1. Calling 832-400-3930 connects to OpenAI Realtime API
2. AI correctly states Raman Patel's A1C as 8.7%
3. AI references clinical notes ("gained 20 pounds in 2 months")
4. Conversation flows naturally (no audio dropouts)
5. Transcripts logged to `diabetes_education_calls` table
6. Zero errors in production logs for 24 hours
7. User (you) confirms voice quality acceptable

---

## Timeline

- **Planning:** ✅ Complete (this document)
- **Implementation:** 4-6 hours
- **Testing:** 2 hours
- **Deployment:** 1 hour
- **Monitoring:** 24 hours
- **Total:** 1-2 business days

---

## Next Steps

**Immediate:**
1. Review this plan - confirm architecture makes sense
2. Approve cost increase (2x vs ElevenLabs)
3. Begin implementation of Phase 2A

**Before Starting:**
- [ ] Confirm OpenAI API key has Realtime API access
- [ ] Verify current OpenAI account balance
- [ ] Set up monitoring/alerting for WebSocket errors
- [ ] Prepare test script for validation

---

**Document Status:** Ready for Review
**Awaiting:** User approval to proceed with implementation
