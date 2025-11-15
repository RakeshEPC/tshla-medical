# Simple Test Call - Direct to ElevenLabs Agent

## The Issue

We've been trying to get the full pre-visit API server working with all the webhooks and database integration, but there are environment variable loading issues causing the server to crash.

## The Solution

**Use Twilio to call your ElevenLabs agent DIRECTLY** - skip all the middleware!

ElevenLabs provides a **phone number** for your agent that Twilio can call directly.

## Steps to Make a Test Call

### 1. Get Your ElevenLabs Agent Phone Number

1. Go to: https://elevenlabs.io/conversational-ai
2. Click on your "Patient intake" agent
3. Look for **"Phone Integration"** or **"Call Settings"**
4. You should see a **phone number** that can call your agent
5. Copy that number

### 2. Make a Test Call Using Twilio

Once you have the ElevenLabs agent phone number, use this command:

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/AC3a28272c27111a4a99531fff151dcdab/Calls.json" \
  -u "AC3a28272c27111a4a99531fff151dcdab:fc4c4319d679602b1edac0c8f370b722" \
  -d "To=+18326073630" \
  -d "From=+18324027671" \
  -d "Url=http://twimlets.com/forward?PhoneNumber=ELEVENLABS_AGENT_PHONE_NUMBER"
```

Replace `ELEVENLABS_AGENT_PHONE_NUMBER` with the number from step 1.

### 3. Answer Your Phone

Your phone will ring, and when you answer, Twilio will conference you with your ElevenLabs agent!

---

## Alternative: Use ElevenLabs WebSocket URL Directly

If you can't find a phone number, we can use the WebSocket URL approach with a minimal TwiML server:

```bash
# Create minimal server
cat > /tmp/minimal-twiml.js << 'EOF'
const express = require('express');
const app = express();

app.post('/twiml', (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_9301k9t886rcewfr8q2qt6e5vcxn">
      <Parameter name="api_key" value="sk_42ac7f8727348932ecaf8c2558b55735b886022d9e03ab78" />
    </Stream>
  </Connect>
</Response>`;
  res.type('application/xml');
  res.send(twiml);
});

app.listen(3100, () => console.log('✅ Minimal TwiML server running on port 3100'));
EOF

# Run it
node /tmp/minimal-twiml.js &

# Start ngrok
ngrok http 3100 &

# Wait 5 seconds
sleep 5

# Get ngrok URL
curl -s http://localhost:4040/api/tunnels | python3 -c "import json, sys; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])"
```

Then make the call with that ngrok URL.

---

## Why This is Better

1. **No server crashes** - Minimal code, minimal dependencies
2. **Direct connection** - Your agent is already configured, just use it!
3. **Works immediately** - No environment variable issues
4. **Easy to debug** - Simple path from Twilio → ElevenLabs

---

## Next Step

Tell me which approach you want to try:
1. Get ElevenLabs agent phone number (easiest)
2. Use minimal TwiML server (5 minutes setup)

Either way, you'll hear your "Patient intake" agent speaking on the phone within 5 minutes!
