# ElevenLabs Webhook Configuration for Pre-Visit Data Collection

Since ElevenLabs uses **Webhooks** instead of custom tools, here's how to set it up:

---

## Option 1: Post-Call Webhook (Recommended)

This webhook is called AFTER the conversation ends.

### In ElevenLabs Settings:

1. Go to: **Settings** (where you are now)
2. Under **"Post-Call Webhook"**, click **"Create Webhook"**
3. Fill in:

**Webhook Name:** `Pre-Visit Data Processor`

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/webhook/post-call
```

**Method:** `POST`

**What it does:**
- Receives conversation data when call ends
- Extracts phone number, duration, success status
- Stores metadata in your database
- *(Note: transcript will still be redacted due to ZRM)*

**Payload ElevenLabs sends:**
```json
{
  "conversation_id": "conv_xxx",
  "agent_id": "agent_xxx",
  "status": "done",
  "duration_secs": 189,
  "phone_number": "+18326073630"
}
```

---

## Option 2: Conversation Initiation Webhook

This webhook is called WHEN the call starts (before conversation begins).

### In ElevenLabs Settings:

1. Under **"Conversation Initiation Client Data Webhook"**, click **"Add webhook"**
2. Fill in:

**Webhook Name:** `Pre-Visit Session Start`

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/session/start
```

**Method:** `POST`

**What it does:**
- Initializes tracking session when call starts
- Gets phone number and conversation ID
- Prepares to receive data

---

## Problem: Can't Extract Data During Call

Unfortunately, with **Zero Retention Mode** enabled:
- ❌ Transcript content is redacted in API responses
- ❌ Audio recordings are not available
- ❌ Webhooks receive redacted data too

### This means we have 3 options:

### **Option A: Use Client Tools (Browser-Based)**

If your agent runs in a browser (web chat), you can use client tools to extract data on the client side before it's sent to ElevenLabs.

**Not applicable** for phone calls though.

---

### **Option B: Disable Zero Retention Mode**

To get full transcripts via webhooks:

1. Contact ElevenLabs support OR
2. Check if there's a setting in **Settings → Privacy** to disable ZRM
3. This will allow webhooks to receive full transcript content

**Trade-off:** Less HIPAA-compliant (full transcripts stored)

---

### **Option C: Use ElevenLabs Agent "Tools" with Custom Functions**

ElevenLabs agents can call custom functions DURING the conversation. Check if your agent has access to "Custom Functions" or "Server Tools":

1. Go to: **Agents → Patient intake → Tools**
2. Look for "Server Tools" or "Custom Functions"
3. If available, add functions that call your API

**Format might be:**
```json
{
  "name": "store_medications",
  "description": "Store medications list",
  "url": "https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/medications",
  "method": "POST",
  "parameters": {
    "conversation_id": {
      "type": "string",
      "source": "system"
    },
    "medications": {
      "type": "array",
      "items": {"type": "string"},
      "description": "List of medications"
    }
  }
}
```

---

## **Recommendation: What To Do Now**

### ✅ **Quick Win - Set Up Post-Call Webhook:**

1. In ElevenLabs Settings → **Post-Call Webhook**
2. Create webhook with URL above
3. This will at least capture:
   - Call metadata (duration, phone, success)
   - Conversation ID (to link to ElevenLabs dashboard)
   - Timestamp

### ✅ **View Full Transcripts in ElevenLabs Dashboard:**

Since API transcripts are redacted, you can:
- View calls at: https://elevenlabs.io/conversational-ai → Conversations
- See full unredacted transcripts there
- Manually review important calls

### ✅ **Best Long-Term Solution:**

Contact ElevenLabs support and ask:
> "How can I extract structured data (medications, concerns, questions) from conversations
> in real-time while keeping Zero Retention Mode enabled for HIPAA compliance?"

They may have a solution like:
- Custom extraction functions
- Server tools that work with ZRM
- Special API endpoints for structured data

---

## Current Setup Status:

✅ API endpoints created and deployed
✅ Webhook receiver ready
✅ Can capture call metadata
⏳ Waiting for ElevenLabs configuration
⏳ Need to determine how to extract transcript data with ZRM enabled

Would you like me to set up the Post-Call Webhook now?
