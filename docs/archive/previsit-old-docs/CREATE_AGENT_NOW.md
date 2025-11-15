# Create ElevenLabs Agent - 5 Minute Guide

## Step 1: Go to This URL

https://elevenlabs.io/conversational-ai

## Step 2: Click "Create Agent"

## Step 3: Fill in These Fields

**Agent Name:**
```
TSHLA Pre-Visit Agent
```

**Voice:** Choose "Rachel" (or any professional female voice)

**First Message:**
```
Hi, this is Sarah from TSHLA Medical calling about your upcoming appointment. Do you have a few minutes for some pre-visit questions?
```

**System Prompt:** Copy EVERYTHING from the file below:
```bash
cat /Users/rakeshpatel/Desktop/tshla-medical/docs/ELEVENLABS_AGENT_SETUP.md
```

Lines 50-150 have the complete system prompt.

## Step 4: Save and Deploy

Click "Save" then "Deploy"

## Step 5: Copy Agent ID

You'll see an ID like: `agent_abc123xyz`

Copy it!

## Step 6: Update .env

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Open .env in your editor
code .env
# OR
open -e .env

# Find line 157 and replace:
ELEVENLABS_AGENT_ID=placeholder_create_agent

# With your real ID:
ELEVENLABS_AGENT_ID=agent_YOUR_REAL_ID_HERE
```

## Step 7: Restart and Test

```bash
# Restart API server
pkill -f "previsit-api-server"
npm run previsit:api:dev &

sleep 5

# Make test call
npx tsx scripts/test-call.ts \
  --phone="+1YOUR_PHONE" \
  --name="Your Name"
```

Done! Your phone will ring!
