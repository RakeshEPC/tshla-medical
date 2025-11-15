# Connect Twilio to ElevenLabs - No Code Solution

## The Easiest Way (5 Minutes)

Use **Twilio Studio** visual editor - no code, no deployment, no ngrok needed!

---

## Steps

### 1. Go to Twilio Studio

https://console.twilio.com/us1/develop/studio/flows

### 2. Create New Flow

- Click "Create new Flow"
- Name: **"Pre-Visit AI Call"**
- Click "Next"

### 3. Drag "Connect Virtual Agent" Widget

- In the left panel, find **"Connect Virtual Agent"**
- Drag it onto the canvas
- Connect the **"Incoming Call"** trigger to it

### 4. Configure the Widget

In the widget settings:

**Connector**: Custom WebSocket

**WebSocket URL**:
```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_9301k9t886rcewfr8q2qt6e5vcxn
```

**Custom Parameters** (click "+ Add"):
- Key: `xi-api-key`
- Value: `sk_42ac7f8727348932ecaf8c2558b55735b886022d9e03ab78`

### 5. Save and Publish

- Click "Save" (top right)
- Click "Publish"

### 6. Connect to Your Twilio Number

- Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- Click on your number: **+1 (832) 402-7671**
- Under "Voice Configuration":
  - **A CALL COMES IN**: Select "Studio Flow"
  - **FLOW**: Select "Pre-Visit AI Call"
- Click "Save"

### 7. Make a Test Call!

Call your number from your phone. You should connect to your Patient Intake agent!

---

## If That Doesn't Work...

The signed URL approach (what we just built) requires deploying the TwiML server to Azure.

Would you like me to:
1. Try Twilio Studio first (above)
2. Deploy to your existing Azure container app

Let me know!
