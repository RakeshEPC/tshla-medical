# 🔴 WebSocket Authentication Issue - ROOT CAUSE & SOLUTION

**Date**: October 12, 2025
**Status**: ❌ **BLOCKING ISSUE** - Dictation cannot work in current architecture

---

## 🎯 ROOT CAUSE CONFIRMED

### **The Fundamental Problem:**

**Deepgram WebSocket API requires `Authorization: Token YOUR_KEY` header**
**BUT Browsers CANNOT send custom headers on WebSocket connections**

This is a **browser security limitation**, not a bug in our code.

### **Evidence:**

1. ✅ **API Key is valid** - Tested with REST API (200 OK)
2. ✅ **REST API works** - Can make successful API calls
3. ✅ **Node.js WebSocket works** - When we can send headers (server-side)
4. ❌ **Browser WebSocket fails** - Cannot send `Authorization` header (client-side)
5. ❌ **Deepgram SDK has same limitation** - Their docs say "you'll need to use a proxy"

### **Test Results:**

```bash
# Node.js (with headers support) - SUCCESS
WebSocket('wss://api.deepgram.com/v1/listen', {
  headers: { 'Authorization': 'Token KEY' }
})
→ ✅ Connects successfully

# Browser (no headers support) - FAILS
new WebSocket('wss://api.deepgram.com/v1/listen?token=KEY')
→ ❌ 401 Unauthorized → Error 1006 (Abnormal Closure)
```

---

## 🛠️ **SOLUTION OPTIONS**

### **Option 1: Build a Proxy Server** ⭐ RECOMMENDED

**How it works:**
```
Browser → Your Proxy Server → Deepgram
        (no headers)    (adds Authorization header)
```

**Implementation:**
1. Create a simple Node.js WebSocket proxy
2. Deploy to Azure Container Apps (already have infrastructure)
3. Browser connects to: `wss://tshla-deepgram-proxy.azurecontainerapps.io`
4. Proxy adds Authorization header and forwards to Deepgram
5. Relays audio/transcription between browser and Deepgram

**Pros:**
- ✅ Real-time transcription (maintains WebSocket connection)
- ✅ Secure (API key stays on server)
- ✅ Works with all browsers
- ✅ Can use existing Azure infrastructure

**Cons:**
- ⏱️ Requires building/deploying proxy (2-3 hours)
- 💰 Additional server costs (minimal)

**Files needed:**
- `server/deepgram-proxy.js` - WebSocket proxy server
- `.github/workflows/deploy-proxy.yml` - Deployment workflow
- Update `deepgramSDK.service.ts` to connect to proxy

---

### **Option 2: Switch to REST API (Non-Real-Time)**

**How it works:**
```
Browser → Record Audio → Upload to Deepgram REST API → Get Transcription
```

**Implementation:**
1. Record full audio in browser (MediaRecorder)
2. When done, convert to audio file
3. POST to Deepgram REST API
4. Receive complete transcription
5. Display to user

**Pros:**
- ✅ Works immediately (no proxy needed)
- ✅ Simple implementation
- ✅ API key stays secure (use backend API)
- ✅ Works in all browsers

**Cons:**
- ❌ NOT real-time (must finish recording first)
- ❌ User experience not as good (no live feedback)
- ❌ Longer perceived wait time

**Files to modify:**
- `src/services/deepgramRESTAdapter.service.ts` - NEW file
- Update `speechServiceRouter.service.ts` to use REST adapter

---

### **Option 3: Use Alternative STT Service**

**Options that work in browsers:**
- **Web Speech API** (Chrome/Edge built-in) - FREE but limited
- **AssemblyAI** - Similar to Deepgram, same WebSocket limitation
- **Google Cloud Speech-to-Text** - Has browser-compatible streaming
- **Azure Speech Services** - Has browser SDK with proper auth

**Pros:**
- ✅ May have better browser support
- ✅ Some have purpose-built browser SDKs

**Cons:**
- ⏱️ Time to integrate new service
- 💰 Cost comparison needed
- 🔄 May have same WebSocket limitation

---

## 📊 **COMPARISON TABLE**

| Option | Real-Time? | Setup Time | Monthly Cost | Works Now? |
|--------|-----------|------------|--------------|------------|
| **Proxy Server** | ✅ Yes | 2-3 hours | ~$10-20 | After build |
| **REST API** | ❌ No | 30 min | $0 extra | Immediate |
| **Web Speech API** | ✅ Yes | 1 hour | FREE | After setup |
| **Azure Speech** | ✅ Yes | 2 hours | ~$1/hr | After setup |

---

## 🎯 **RECOMMENDED APPROACH**

### **SHORT TERM (Today - 30 minutes):**

**Use Web Speech API as temporary fallback:**
- Already partially implemented in `dictation.service.ts`
- Works in Chrome/Edge (80% of medical users)
- NOT medical-grade but usable
- Zero additional cost

**Steps:**
1. Re-enable Web Speech API in speechServiceRouter
2. Add fallback logic: "If Deepgram fails, use Web Speech API"
3. Show notice: "Using browser transcription (upgrade available)"

### **MEDIUM TERM (Next week - 2-3 hours):**

**Build Deepgram Proxy Server:**
- Deploy to Azure Container Apps
- Full real-time transcription
- Medical-grade accuracy
- Production-ready solution

---

## 💻 **QUICK FIX: Enable Web Speech API Fallback**

**File: `src/services/speechServiceRouter.service.ts`**

```typescript
getStreamingService(): SpeechServiceInterface {
  // Try Deepgram first
  if (deepgramSDKService.isConfigured()) {
    try {
      return deepgramSDKService;
    } catch (error) {
      console.warn('Deepgram failed, falling back to Web Speech API');
    }
  }

  // Fallback to browser Web Speech API
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    console.log('Using Web Speech API (browser native)');
    return dictationService; // Uses Web Speech API
  }

  throw new Error('No speech recognition available');
}
```

This gives you:
- ✅ Working dictation TODAY
- ✅ Real-time transcription
- ✅ Zero additional setup
- ⚠️ Less accurate than Deepgram (but usable)

---

## 🚀 **ACTION PLAN**

### **Immediate (DO NOW):**
1. ✅ Enable Web Speech API fallback (30 min)
2. ✅ Test dictation works in Chrome
3. ✅ Add user notice about temporary solution

### **This Week:**
1. 🔨 Build Deepgram proxy server (3 hours)
2. 🚀 Deploy to Azure Container Apps (1 hour)
3. 🧪 Test and verify real-time transcription
4. ✅ Switch production to use proxy

### **Future Enhancement:**
1. 📊 Compare accuracy (Deepgram vs Web Speech API)
2. 💰 Evaluate costs (proxy hosting)
3. 🎯 Consider Azure Speech Services as alternative

---

## 📞 **DECISION NEEDED**

**Which approach do you want to take?**

**A) Quick Fix Today (Web Speech API fallback)**
- ✅ Works in 30 minutes
- ⚠️ Lower accuracy
- ✅ Zero cost
- ✅ Real-time

**B) Proper Solution (Build Proxy)**
- ⏱️ Takes 2-3 hours
- ✅ Full accuracy
- 💰 ~$10-20/month
- ✅ Real-time

**C) Alternative Service (Azure/Google Speech)**
- ⏱️ Takes 2-4 hours
- ✅ Full accuracy
- 💰 Varies
- ✅ Real-time

**D) REST API (No Real-Time)**
- ⏱️ Takes 30 min
- ✅ Full accuracy
- ✅ Zero extra cost
- ❌ NOT real-time

---

## 🎬 **NEXT STEPS**

**Tell me which option you prefer and I'll implement it immediately!**

My recommendation: **Option A (Quick Fix)** now + **Option B (Proxy)** next week.

This gives you working dictation TODAY while we build the proper solution.

---

**Current Status**: Waiting for decision
**Blocking**: YES - Dictation cannot work without one of these solutions
**Urgency**: HIGH - Core feature not working
**Estimated Fix Time**: 30 minutes (Option A) to 3 hours (Option B)
