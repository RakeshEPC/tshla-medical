# 🧪 FINAL TESTING INSTRUCTIONS - Deepgram Debugging

**Date**: October 12, 2025 17:48 CDT
**Status**: 🔄 New deployment in progress with debug logging

---

## 🎯 **WHAT WAS ADDED**

### **Comprehensive Debug Logging**

The app will now show detailed console logs to help diagnose the WebSocket error 1006:

1. **API Key Verification**:
   ```
   ✅ Deepgram API key loaded: 8d226631...453c
      Key length: 40 characters
   ```

2. **Configuration Check**:
   ```
   ✅ Deepgram configuration: {
      model: "nova-2-medical",
      language: "en-US",
      tier: "enhanced"
   }
   ```

3. **WebSocket URL Building**:
   ```
   🔗 Building Deepgram WebSocket URL: {
      baseUrl: "wss://api.deepgram.com/v1/listen",
      tokenPresent: true,
      tokenLength: 40,
      model: "nova-2-medical",
      paramCount: 11
   }
   ```

4. **Enhanced Error Messages** for Code 1006:
   ```
   ⚠️ ERROR 1006: Abnormal Closure (Connection failed before handshake)

   🔍 Most common causes:
      1. Invalid or missing Deepgram API key
      2. Network/firewall blocking WebSocket connections
      3. Deepgram service temporarily unavailable
      4. CORS policy blocking the connection

   💡 Troubleshooting:
      • Check browser console for "Deepgram API key loaded" message
      • Verify internet connection is stable
      • Try refreshing the page or using a different browser
      • Check Deepgram service status at status.deepgram.com
   ```

---

## 📋 **TESTING CHECKLIST**

### **Step 1: Wait for Deployment** (~3-5 minutes)

Monitor at: https://github.com/RakeshEPC/tshla-medical/actions

Look for the latest "Deploy Frontend to Azure Static Web Apps" workflow with status:
- 🔄 In progress (yellow)
- ✅ Success (green checkmark)

---

### **Step 2: Clear Browser Cache (CRITICAL!)**

The NEW bundle with debug logging won't load if cache isn't cleared:

#### **Option A: Hard Refresh**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

#### **Option B: Incognito/Private Mode (RECOMMENDED)**
- Chrome: `Ctrl + Shift + N` / `Cmd + Shift + N`
- Firefox: `Ctrl + Shift + P` / `Cmd + Shift + P`
- Safari: `Cmd + Shift + N`
- Edge: `Ctrl + Shift + N`

#### **Option C: Clear All Site Data**
1. Press F12 to open Dev Tools
2. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Click "Clear storage" or "Clear site data"
4. Refresh page

---

### **Step 3: Open Browser Console (F12)**

**BEFORE** trying dictation:
1. Press `F12` to open Developer Tools
2. Click "Console" tab
3. Keep it open during testing
4. This is where all debug logs will appear

---

### **Step 4: Login**

1. Go to: https://www.tshla.ai/login
2. Login:
   ```
   Email: admin@tshla.ai
   Password: TshlaSecure2025!
   ```
3. Should redirect to `/admin/account-manager`

---

### **Step 5: Navigate to Dictation**

Click one of:
- "Dictation" in menu, OR
- "Quick Note" in menu, OR
- Direct URL: https://www.tshla.ai/dictation

---

### **Step 6: Check Console for Initialization Logs**

**LOOK FOR THESE MESSAGES IN CONSOLE:**

✅ **Expected (Good):**
```
✅ Deepgram API key loaded: 8d226631...453c
   Key length: 40 characters

✅ Deepgram configuration: {
   model: "nova-2-medical",
   language: "en-US",
   tier: "enhanced"
}
```

❌ **Problem (Bad):**
```
❌ CRITICAL: VITE_DEEPGRAM_API_KEY is undefined!
Available environment variables: [...]
```

**If you see the ❌ message:**
- API key is NOT in the production bundle
- This means GitHub secret wasn't used or deployment cached old version
- Try waiting 5 more minutes and hard refresh again

---

### **Step 7: Try Recording**

1. Click **"Start Recording"** button
2. **Allow** microphone when browser asks
3. Watch console for more logs

---

### **Step 8: Analyze Console Output**

#### **Scenario A: API Key NOT Loading**
```
❌ CRITICAL: VITE_DEEPGRAM_API_KEY is undefined!
```
**Diagnosis**: GitHub secret not included in build
**Solution**: Wait longer for deployment or check GitHub Actions logs

#### **Scenario B: WebSocket URL Building**
```
🔗 Building Deepgram WebSocket URL: {
   baseUrl: "wss://api.deepgram.com/v1/listen",
   tokenPresent: true,
   tokenLength: 40,
   model: "nova-2-medical"
}
```
**Then immediately:**
```
❌ Deepgram Error 1006 - Detailed Info: {
   code: 1006,
   reason: "None provided",
   wasClean: false,
   apiKeyConfigured: true,
   apiKeyLength: 40,
   model: "nova-2-medical"
}
```

**Diagnosis**:
- API key IS loading ✅
- BUT WebSocket connection still failing
- Possible causes:
  1. **API key is invalid/expired** (test at https://console.deepgram.com)
  2. **Network/firewall blocking WebSockets**
  3. **Browser blocking WebSockets** (try different browser)
  4. **Deepgram service down** (check status.deepgram.com)

#### **Scenario C: Different Error Code**
```
❌ ERROR 4008: Invalid API key or authentication failed
```
**Diagnosis**: API key is wrong or expired
**Solution**: Check Deepgram console, verify key is correct

```
❌ ERROR 4009: Insufficient credits
```
**Diagnosis**: Deepgram account out of credits
**Solution**: Add credits at https://console.deepgram.com/billing

---

## 🔍 **DIAGNOSTIC FLOW CHART**

```
1. Open Console → See API key loaded?
   │
   ├─ NO ❌ → Bundle doesn't have key
   │         → Wait for new deployment
   │         → Hard refresh / Incognito
   │
   └─ YES ✅ → Continue to step 2

2. Click Start Recording → WebSocket connects?
   │
   ├─ NO ❌ → Check error code
   │   │
   │   ├─ 1006 → Check "Detailed Info" log
   │   │   │
   │   │   ├─ apiKeyConfigured: false → Key lost somehow
   │   │   └─ apiKeyConfigured: true → Network/service issue
   │   │
   │   ├─ 4008 → Invalid API key
   │   └─ 4009 → No credits
   │
   └─ YES ✅ → Dictation works! 🎉
```

---

## 📝 **WHAT TO REPORT**

After testing, please share:

### 1. Console Screenshot
- Screenshot of browser console after trying to record
- Should show initialization logs + any errors

### 2. Specific Error Details
From console, copy and paste:
```
❌ Deepgram Error 1006 - Detailed Info: {
   // Copy entire object here
}
```

### 3. Network Tab (if needed)
If WebSocket shows 1006:
1. Open Dev Tools → Network tab
2. Filter by "WS" (WebSockets)
3. Try recording
4. Click the WebSocket connection
5. Check:
   - Status code
   - Response headers
   - Any error messages

### 4. Browser & OS
- Browser: Chrome/Firefox/Safari/Edge
- Version: ?
- OS: Windows/Mac/Linux

---

## 🎯 **SUCCESS CRITERIA**

### **Test PASSED if:**
✅ Console shows "✅ Deepgram API key loaded: 8d226631...453c"
✅ Console shows "✅ Deepgram configuration: {...}"
✅ Console shows "🔗 Building Deepgram WebSocket URL: {...}"
✅ Recording starts without errors
✅ Real-time transcription appears
✅ No error 1006

### **Test FAILED if:**
❌ Console shows "❌ CRITICAL: VITE_DEEPGRAM_API_KEY is undefined!"
❌ Error 1006 still appears after key is loaded
❌ Different error code appears

---

## ⏰ **TIMELINE**

- **Now**: Push completed (17:48 CDT)
- **+2 min**: Build starts
- **+5 min**: Build completes
- **+7 min**: Deployment completes
- **+10 min**: CDN propagation (may vary)
- **Test at**: 17:58 CDT or later

---

## 📞 **IF ISSUES PERSIST**

### Option 1: Test Locally
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm run dev
# Open: http://localhost:5173
# Login and test dictation
# Should work locally (has .env file)
```

### Option 2: Verify Deepgram Account
1. Go to: https://console.deepgram.com
2. Login with your Deepgram account
3. Check:
   - API key is active: `8d226631680379ac8ea48ed0bf73df2c51df453c`
   - Account has credits
   - No usage limits reached
   - API key has proper permissions

### Option 3: Test API Key Directly
```bash
# Test the API key with curl
curl -X POST "https://api.deepgram.com/v1/projects" \
  -H "Authorization: Token 8d226631680379ac8ea48ed0bf73df2c51df453c"

# Should return 200 OK with project list
# If 401/403 → API key is invalid
```

---

## ✅ **NEXT STEPS**

1. **Wait** for deployment (~7 minutes from 17:48 = ready at 17:55)
2. **Open** Incognito/Private browser window
3. **Open** Developer Console (F12)
4. **Login** to https://www.tshla.ai
5. **Navigate** to dictation
6. **Check** console for debug logs
7. **Try** recording
8. **Report** results

---

**Deployment started**: 17:48 CDT
**Expected ready**: 17:55 CDT
**Test after**: 17:58 CDT (to allow CDN propagation)

Good luck! 🤞
