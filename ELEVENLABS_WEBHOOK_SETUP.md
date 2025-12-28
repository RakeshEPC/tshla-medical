# ElevenLabs Webhook Setup for Diabetes Education

## Overview
To capture call transcripts and save them to the database, you need to configure ElevenLabs to send post-call webhooks to your Azure API.

## Webhook URL

**Production URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript
```

## Setup Instructions

### 1. Access ElevenLabs Agents Platform Settings
1. Go to [ElevenLabs Agents Platform](https://elevenlabs.io/app/conversational-ai)
2. Click on your profile/settings icon
3. Navigate to **"Agents Platform settings"** or **"Workspace settings"**

### 2. Configure Post-Call Webhooks
1. Look for **"Webhooks"** or **"Post-call webhooks"** section
2. Enable **"Transcription webhooks"**
3. Enter the webhook URL:
   ```
   https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript
   ```
4. Select **"HTTP POST"** method
5. Save the configuration

### 3. Webhook Applies to All Agents
- This webhook setting applies to **all agents in your workspace**
- It will receive transcripts for:
  - English Diabetes Educator (agent_id: `ELEVENLABS_DIABETES_AGENT_EN`)
  - Spanish Diabetes Educator (agent_id: `ELEVENLABS_DIABETES_AGENT_ES`)
  - Hindi Diabetes Educator (agent_id: `ELEVENLABS_DIABETES_AGENT_HI`)

## What Happens After Configuration

### When a patient calls:
1. **Call starts** → Twilio receives call at 832-400-3930
2. **Authentication** → System verifies caller's phone number against database
3. **Connection** → Call connects to appropriate ElevenLabs agent (based on language)
4. **Conversation** → Patient talks with AI diabetes educator (up to 10 minutes)
5. **Call ends** → Two webhooks fire:
   - **Twilio status webhook** → Updates call duration and status
   - **ElevenLabs transcript webhook** → Saves transcript and generates AI summary

### Database Updates
After the webhooks complete, the database will contain:
- **Call duration**: From Twilio (in seconds)
- **Full transcript**: From ElevenLabs (formatted as "AI: ..." and "Patient: ...")
- **AI-generated summary**: Created using GPT-4o-mini (2-3 sentence summary of key topics)
- **Topics discussed**: Extracted from ElevenLabs analysis (if available)
- **Conversation ID**: ElevenLabs conversation ID for reference

## Testing the Webhook

### 1. Test the Endpoint Manually
```bash
curl -X POST https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/elevenlabs/diabetes-education-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transcription",
    "data": {
      "conversation_id": "test-123",
      "agent_id": "test-agent",
      "transcript": [
        {"role": "agent", "message": "Hello, how can I help you today?"},
        {"role": "user", "message": "What medications am I on?"}
      ]
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Call not found in database"
}
```
(This is expected since "test-123" doesn't exist - the endpoint is working)

### 2. Make a Real Test Call
1. Call 832-400-3930 from one of your enrolled phone numbers
2. Have a short conversation with the AI
3. Hang up after 30-60 seconds
4. Wait 1-2 minutes for webhooks to process
5. Check the database:
   ```sql
   SELECT
     call_started_at,
     duration_seconds,
     call_status,
     LENGTH(transcript) as transcript_length,
     summary
   FROM diabetes_education_calls
   ORDER BY call_started_at DESC
   LIMIT 1;
   ```

### 3. Check Azure Logs
```bash
az containerapp logs show \
  --name tshla-unified-api \
  --resource-group tshla-rg \
  --tail 100 | grep "DiabetesEdu"
```

Look for:
- `📞 [DiabetesEdu] Incoming call received`
- `✅ [DiabetesEdu] Patient authenticated`
- `📊 [DiabetesEdu] Call status update received`
- `📝 [DiabetesEdu] ElevenLabs transcript webhook received`
- `✅ [DiabetesEdu] Transcript saved successfully`

## Troubleshooting

### Webhook Not Being Received
1. **Check ElevenLabs webhook configuration**: Verify URL is correct (no typos)
2. **Check ElevenLabs webhook logs**: Look for failed delivery attempts
3. **Verify Azure endpoint is accessible**: Test with curl command above
4. **Check firewall settings**: Ensure ElevenLabs IPs are not blocked

### Transcript Not Saving
1. **Check conversation_id matching**: The system uses `elevenlabs_conversation_id` to find the call
2. **Verify database field exists**: Check that `elevenlabs_conversation_id` column exists in table
3. **Check Azure logs**: Look for error messages in webhook handler

### No AI Summary Generated
1. **Check OpenAI API key**: Verify `VITE_OPENAI_API_KEY` is set in Azure environment
2. **Check transcript length**: Summary only generates if transcript > 50 characters
3. **Check Azure logs**: Look for OpenAI API errors

## Security Considerations

### HMAC Signature Validation (Optional but Recommended)
ElevenLabs can sign webhooks with HMAC. To enable:

1. In ElevenLabs settings, enable "Webhook Authentication"
2. Copy your webhook signing secret
3. Add to Azure environment variables as `ELEVENLABS_WEBHOOK_SECRET`
4. Update the webhook handler to validate signatures

Example validation code:
```javascript
const crypto = require('crypto');

function validateElevenLabsWebhook(req, secret) {
  const signature = req.headers['elevenlabs-signature'];
  const timestamp = req.headers['elevenlabs-timestamp'];
  const body = JSON.stringify(req.body);

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  return signature === expected;
}
```

## Webhook Payload Reference

### ElevenLabs Transcription Webhook Format
```json
{
  "type": "transcription",
  "event_timestamp": "2025-12-26T20:00:00.000Z",
  "data": {
    "agent_id": "agent_abc123",
    "conversation_id": "conv_xyz789",
    "user_id": "user_123",
    "transcript": [
      {
        "role": "agent",
        "message": "Hello! I'm your diabetes educator. What questions do you have today?",
        "timestamp": "2025-12-26T20:00:05.000Z"
      },
      {
        "role": "user",
        "message": "What was my last A1C result?",
        "timestamp": "2025-12-26T20:00:10.000Z"
      }
    ],
    "metadata": {
      "start_time": "2025-12-26T20:00:00.000Z",
      "end_time": "2025-12-26T20:03:00.000Z",
      "duration_seconds": 180
    },
    "analysis": {
      "topics": ["A1C results", "lab values", "diabetes management"]
    }
  }
}
```

## Cost Considerations

Each webhook call that generates an AI summary uses:
- **OpenAI GPT-4o-mini**: ~200 tokens per summary
- **Cost**: ~$0.0003 per summary (3 cents per 100 summaries)

## Support

If webhooks are not working after configuration:
1. Check Azure logs for errors
2. Verify ElevenLabs webhook delivery logs
3. Test endpoint manually with curl
4. Contact ElevenLabs support if webhook delivery fails

---

**Last Updated:** December 26, 2025
**Webhook Version:** 1.0
